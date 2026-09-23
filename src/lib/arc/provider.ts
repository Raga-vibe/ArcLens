import "server-only";
import { addressToTopic, normalizeTransaction, type RawLog } from "@/lib/analytics/normalize";
import type { RawReceipt, RawTx } from "@/lib/analytics/transaction";
import type { Address, AddressKind, Hex, ScanWindow, TokenTransfer, WindowKey } from "@/lib/types";
import { NATIVE_TRANSFER_EMITTER, TRANSFER_TOPIC } from "./chain";
import { BLOCKS_PER_SECOND, serverConfig, WINDOW_SECONDS } from "./config";
import { hex, num, rpc, RpcError } from "./rpc";

// Arc data provider backed by plain JSON-RPC. Swap this module for an indexer
// (Envio, Goldsky, Alchemy Transfers…) by implementing the same exports.

interface Block {
  number: string;
  timestamp: string;
}

// ---- small LRU cache ------------------------------------------------------
// Arc has deterministic, instant finality, so logs in a closed block range
// never change and can be cached indefinitely (bounded by size).

class Lru<V> {
  private map = new Map<string, V>();
  constructor(private max: number) {}
  get(k: string) {
    const v = this.map.get(k);
    if (v !== undefined) {
      this.map.delete(k);
      this.map.set(k, v);
    }
    return v;
  }
  set(k: string, v: V) {
    this.map.delete(k);
    this.map.set(k, v);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value!);
  }
}

const chunkCache = new Lru<RawLog[]>(20_000);
const blockTsCache = new Lru<number>(5_000);
const codeCache = new Lru<boolean>(5_000);

let latestCache: { block: number; at: number } | null = null;

export async function getLatestBlock(): Promise<number> {
  if (latestCache && Date.now() - latestCache.at < 2_000) return latestCache.block;
  const block = num(await rpc<string>("eth_blockNumber"));
  latestCache = { block, at: Date.now() };
  return block;
}

export async function getBlockTimestamp(n: number): Promise<number> {
  const k = String(n);
  const cached = blockTsCache.get(k);
  if (cached !== undefined) return cached;
  const b = await rpc<Block | null>("eth_getBlockByNumber", [hex(n), false]);
  if (!b) throw new RpcError(`block ${n} not found`, "missing", "not-found");
  const ts = num(b.timestamp);
  blockTsCache.set(k, ts);
  return ts;
}

export async function resolveWindow(key: WindowKey, latest: number): Promise<ScanWindow> {
  const secs = WINDOW_SECONDS[key];
  const fromBlock = secs === null ? 0 : Math.max(0, latest - secs * BLOCKS_PER_SECOND + 1);
  const [fromTimestamp, toTimestamp] = await Promise.all([
    getBlockTimestamp(fromBlock),
    getBlockTimestamp(latest),
  ]);
  return { key, fromBlock, toBlock: latest, fromTimestamp, toTimestamp };
}

// ---- log scanning -----------------------------------------------------------

async function getLogsAdaptive(
  topics: (string | null)[],
  from: number,
  to: number,
): Promise<RawLog[]> {
  try {
    return await rpc<RawLog[]>("eth_getLogs", [
      { fromBlock: hex(from), toBlock: hex(to), address: NATIVE_TRANSFER_EMITTER, topics },
    ]);
  } catch (err) {
    // Provider refused the range or result size: split and retry.
    if (err instanceof RpcError && err.kind === "range" && to > from) {
      const mid = from + Math.floor((to - from) / 2);
      const [a, b] = await Promise.all([
        getLogsAdaptive(topics, from, mid),
        getLogsAdaptive(topics, mid + 1, to),
      ]);
      return a.concat(b);
    }
    throw err;
  }
}

export interface ScanProgress {
  done: number;
  total: number;
  found: number;
}

/**
 * All native USDC transfers where `address` is sender or recipient within the
 * window. Chunks are aligned to fixed boundaries so closed chunks are cacheable.
 */
export async function getWalletTransactions(
  address: Address,
  window: ScanWindow,
  onProgress?: (p: ScanProgress) => void,
): Promise<TokenTransfer[]> {
  const R = serverConfig.logBlockRange;
  const topic = addressToTopic(address);
  const jobs: { from: number; to: number; pos: 1 | 2; closed: boolean }[] = [];
  for (let start = Math.floor(window.fromBlock / R) * R; start <= window.toBlock; start += R) {
    const from = Math.max(start, window.fromBlock);
    const end = start + R - 1;
    const to = Math.min(end, window.toBlock);
    // Newest first, so partial progress is the most relevant data.
    jobs.unshift({ from, to, pos: 1, closed: to === end && from === start });
    jobs.unshift({ from, to, pos: 2, closed: to === end && from === start });
  }

  const logs: RawLog[] = [];
  let done = 0;
  let cursor = 0;
  const total = jobs.length;
  onProgress?.({ done, total, found: 0 });

  const workers = Math.max(
    1,
    serverConfig.rpcUrls.length * serverConfig.concurrencyPerEndpoint,
  );
  async function worker() {
    while (cursor < jobs.length) {
      const j = jobs[cursor++];
      const key = `${address}:${j.pos}:${j.from}:${j.to}`;
      let result = j.closed ? chunkCache.get(key) : undefined;
      if (!result) {
        const topics: (string | null)[] = [TRANSFER_TOPIC, null, null];
        topics[j.pos] = topic;
        result = await getLogsAdaptive(topics, j.from, j.to);
        if (j.closed) chunkCache.set(key, result);
      }
      logs.push(...result);
      done++;
      onProgress?.({ done, total, found: logs.length });
    }
  }
  await Promise.all(Array.from({ length: Math.min(workers, jobs.length) }, worker));

  // Some RPCs omit the non-standard blockTimestamp; backfill from headers.
  const missing = [...new Set(logs.filter((l) => !l.blockTimestamp).map((l) => num(l.blockNumber)))];
  const ts = new Map<number, number>();
  for (let i = 0; i < missing.length; i += 8) {
    const batch = missing.slice(i, i + 8);
    const got = await Promise.all(batch.map(getBlockTimestamp));
    batch.forEach((b, k) => ts.set(b, got[k]));
  }

  const out: TokenTransfer[] = [];
  for (const l of logs) {
    const t = normalizeTransaction(l, ts.get(num(l.blockNumber)));
    if (t) out.push(t);
  }
  return out;
}

// ---- point-in-time facts ----------------------------------------------------

export async function getWalletSnapshot(address: Address) {
  const [balance, nonce, code] = await Promise.all([
    rpc<string>("eth_getBalance", [address, "latest"]),
    rpc<string>("eth_getTransactionCount", [address, "latest"]),
    rpc<string>("eth_getCode", [address, "latest"]),
  ]);
  const isContract = !!code && code !== "0x";
  codeCache.set(address, isContract);
  return { balanceRaw: BigInt(balance), nonce: num(nonce), isContract };
}

/** Contract vs externally-owned account, for a bounded list of addresses. */
export async function getAddressKinds(addresses: Address[]): Promise<Record<string, AddressKind>> {
  const out: Record<string, AddressKind> = {};
  await Promise.all(
    addresses.map(async (a) => {
      const c = codeCache.get(a);
      if (c !== undefined) {
        out[a] = c ? "contract" : "account";
        return;
      }
      try {
        const code = await rpc<string>("eth_getCode", [a, "latest"]);
        const isC = !!code && code !== "0x";
        codeCache.set(a, isC);
        out[a] = isC ? "contract" : "account";
      } catch {
        out[a] = "unknown";
      }
    }),
  );
  return out;
}

// ---- transactions -------------------------------------------------------------

export async function getTransaction(hash: Hex) {
  const [tx, receipt] = await Promise.all([
    rpc<RawTx | null>("eth_getTransactionByHash", [hash]),
    rpc<RawReceipt | null>("eth_getTransactionReceipt", [hash]),
  ]);
  if (!tx) return null;
  if (!receipt || !tx.blockNumber) return { tx, receipt: null, timestamp: null, latest: await getLatestBlock() };
  const [timestamp, latest] = await Promise.all([
    getBlockTimestamp(num(receipt.blockNumber)),
    getLatestBlock(),
  ]);
  return { tx, receipt, timestamp, latest };
}

export async function isContract(address: Address) {
  const kinds = await getAddressKinds([address]);
  return kinds[address] === "contract";
}
