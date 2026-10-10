import "server-only";
import { toUnits, type RawLog } from "@/lib/analytics/normalize";
import type { RawReceipt, RawTx } from "@/lib/analytics/transaction";
import type { Address, AddressKind, Hex, ScanWindow, TokenTransfer, WindowKey } from "@/lib/types";
import { WINDOW_SECONDS } from "@/lib/arc/config";
import { RpcError, hex, num, robinhoodRpc } from "@/lib/arc/rpc";
import { getNetwork } from "@/lib/networks";
import { robinhoodConfig } from "./config";

const network = getNetwork("robinhood-testnet");
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ADDRESS_RE = /^0x[0-9a-f]{40}$/i;

interface Block {
  number: string;
  timestamp: string;
}
interface ExplorerBlock { height: number }

interface Entity { hash: string }
interface ExplorerPage<T> { items: T[]; next_page_params: Record<string, string | number | null> | null }
interface ExplorerTransaction {
  hash: string;
  from: Entity;
  to: Entity | null;
  created_contract?: Entity | null;
  value: string;
  block_number: number;
  timestamp: string;
  result?: string;
  status?: string;
  nonce: number;
  gas_used: string;
  gas_price: string;
}
interface ExplorerInternalTransaction {
  transaction_hash: string;
  from: Entity;
  to: Entity | null;
  created_contract?: Entity | null;
  value: string;
  block_number: number;
  timestamp: string;
  success: boolean;
  type: string;
  index: number;
}
interface ExplorerTokenTransfer {
  transaction_hash: string;
  from: Entity;
  to: Entity;
  block_number: number;
  timestamp: string;
  log_index: number;
  token_type: string;
  token: { address_hash: string; symbol?: string | null; decimals?: string | null; type?: string };
  total: { value: string; decimals?: string | null };
}

const blockTimestampCache = new Map<number, number>();
let latestCache: { block: number; at: number } | null = null;

export async function getLatestBlock(): Promise<number> {
  if (latestCache && Date.now() - latestCache.at < 2_000) return latestCache.block;
  let indexedResponse: Response;
  try {
    const [rpcHead, response] = await Promise.all([
      robinhoodRpc<string>("eth_blockNumber"),
      fetch(`${robinhoodConfig.explorerApiUrl}/blocks`, { cache: "no-store", signal: AbortSignal.timeout(15_000) }),
    ]);
    indexedResponse = response;
    if (!indexedResponse.ok) throw new RpcError(`explorer HTTP ${indexedResponse.status}`, indexedResponse.status, "upstream");
    let indexed: { items?: ExplorerBlock[] };
    try {
      indexed = await indexedResponse.json() as { items?: ExplorerBlock[] };
    } catch {
      throw new RpcError("invalid explorer response", "invalid-response", "upstream");
    }
    const indexedHead = indexed.items?.[0]?.height;
    if (!Number.isSafeInteger(indexedHead)) throw new RpcError("explorer head unavailable", "missing", "upstream");
    // The address-history indexer can trail the RPC head. Stop the report at
    // the latest block it has indexed so a quiet newest range is not misleading.
    const block = Math.min(num(rpcHead), indexedHead!);
    latestCache = { block, at: Date.now() };
    return block;
  } catch (error) {
    if (error instanceof RpcError) throw error;
    throw new RpcError((error as Error).message, "explorer", "upstream");
  }
}

export async function getBlockTimestamp(blockNumber: number): Promise<number> {
  const cached = blockTimestampCache.get(blockNumber);
  if (cached !== undefined) return cached;
  const block = await robinhoodRpc<Block | null>("eth_getBlockByNumber", [hex(blockNumber), false]);
  if (!block) throw new RpcError(`block ${blockNumber} not found`, "missing", "not-found");
  const timestamp = num(block.timestamp);
  blockTimestampCache.set(blockNumber, timestamp);
  if (blockTimestampCache.size > 5_000) blockTimestampCache.delete(blockTimestampCache.keys().next().value!);
  return timestamp;
}

/** Find the first block at or after the requested timestamp (no block-rate guess). */
export async function resolveWindow(key: WindowKey, latest: number): Promise<ScanWindow> {
  const toTimestamp = await getBlockTimestamp(latest);
  if (key === "all") {
    const fromTimestamp = await getBlockTimestamp(0);
    return { key, fromBlock: 0, toBlock: latest, fromTimestamp, toTimestamp };
  }
  const cutoff = Math.max(0, toTimestamp - WINDOW_SECONDS[key]!);
  let low = 0;
  let high = latest;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if ((await getBlockTimestamp(middle)) < cutoff) low = middle + 1;
    else high = middle;
  }
  const fromBlock = low;
  const fromTimestamp = await getBlockTimestamp(fromBlock);
  return { key, fromBlock, toBlock: latest, fromTimestamp, toTimestamp };
}

function addressOf(entity: Entity | null | undefined): Address | null {
  const address = entity?.hash;
  return address && ADDRESS_RE.test(address) ? address.toLowerCase() as Address : null;
}

function timestampOf(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = Math.floor(Date.parse(raw) / 1000);
  return Number.isFinite(value) ? value : null;
}

function validRawAmount(raw: string | undefined): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

function transferBase(input: {
  id: string;
  txHash: string;
  logIndex: number;
  blockNumber: number;
  timestamp: number;
  from: Address;
  to: Address;
  raw: bigint;
  assetKey: string;
  token: string;
  tokenAddress: Address | null;
  decimals: number;
  assetKind: "native" | "erc20";
}): TokenTransfer {
  return {
    id: input.id,
    txHash: input.txHash.toLowerCase() as Hex,
    logIndex: input.logIndex,
    blockNumber: input.blockNumber,
    timestamp: input.timestamp,
    from: input.from,
    to: input.to,
    valueRaw: input.raw.toString(),
    value: toUnits(input.raw, input.decimals),
    assetKey: input.assetKey,
    token: input.token,
    tokenAddress: input.tokenAddress,
    decimals: input.decimals,
    assetKind: input.assetKind,
  };
}

function transferFromExplorerTransaction(item: ExplorerTransaction, wallet: Address): TokenTransfer | null {
  if (item.result !== "success" || item.status !== "ok") return null;
  const from = addressOf(item.from);
  const to = addressOf(item.to) ?? addressOf(item.created_contract);
  const raw = validRawAmount(item.value);
  const timestamp = timestampOf(item.timestamp);
  if (!from || !to || !raw || raw === 0n || !timestamp || !ADDRESS_RE.test(item.hash)) return null;
  if ((from === wallet) === (to === wallet)) return null;
  return transferBase({
    id: `${item.hash.toLowerCase()}:native:external`, txHash: item.hash, logIndex: 0,
    blockNumber: item.block_number, timestamp, from, to, raw, assetKey: "native",
    token: network.nativeCurrency.symbol, tokenAddress: null, decimals: network.nativeCurrency.decimals, assetKind: "native",
  });
}

function transferFromInternal(item: ExplorerInternalTransaction, wallet: Address): TokenTransfer | null {
  if (!item.success || item.type.toLowerCase() === "delegatecall" || item.type.toLowerCase() === "staticcall") return null;
  const from = addressOf(item.from);
  const to = addressOf(item.to) ?? addressOf(item.created_contract);
  const raw = validRawAmount(item.value);
  const timestamp = timestampOf(item.timestamp);
  if (!from || !to || !raw || raw === 0n || !timestamp || !ADDRESS_RE.test(item.transaction_hash)) return null;
  if ((from === wallet) === (to === wallet)) return null;
  return transferBase({
    id: `${item.transaction_hash.toLowerCase()}:native:internal:${item.index}`,
    txHash: item.transaction_hash, logIndex: item.index + 1_000_000, blockNumber: item.block_number,
    timestamp, from, to, raw, assetKey: "native", token: network.nativeCurrency.symbol,
    tokenAddress: null, decimals: network.nativeCurrency.decimals, assetKind: "native",
  });
}

function transferFromTokenLog(item: ExplorerTokenTransfer, wallet: Address): TokenTransfer | null {
  if (item.token_type !== "ERC-20" || item.token?.type && item.token.type !== "ERC-20") return null;
  const from = addressOf(item.from);
  const to = addressOf(item.to);
  const tokenAddress = item.token?.address_hash?.toLowerCase();
  const raw = validRawAmount(item.total?.value);
  const decimals = Number(item.total?.decimals ?? item.token?.decimals);
  const timestamp = timestampOf(item.timestamp);
  if (!from || !to || !tokenAddress || !ADDRESS_RE.test(tokenAddress) || !raw || raw === 0n || !timestamp || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
  if ((from === wallet) === (to === wallet)) return null;
  const symbol = typeof item.token.symbol === "string" && item.token.symbol.length <= 32 ? item.token.symbol : "ERC-20";
  return transferBase({
    id: `${item.transaction_hash.toLowerCase()}:log:${item.log_index}`, txHash: item.transaction_hash,
    logIndex: item.log_index, blockNumber: item.block_number, timestamp, from, to, raw,
    assetKey: tokenAddress, token: symbol, tokenAddress: tokenAddress as Address, decimals, assetKind: "erc20",
  });
}

async function fetchActivityPages<T>(
  address: Address,
  path: string,
  fromBlock: number,
  toBlock: number,
  signal?: AbortSignal,
): Promise<T[]> {
  let url = new URL(`${robinhoodConfig.explorerApiUrl}/addresses/${address}/${path}`);
  const items: T[] = [];
  for (let page = 0; page < robinhoodConfig.maxExplorerPages; page++) {
    if (signal?.aborted) throw new RpcError("aborted", "aborted", "upstream");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    } catch (error) {
      throw new RpcError((error as Error).message, "explorer", "upstream");
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
    if (!response.ok) throw new RpcError(`explorer HTTP ${response.status}`, response.status, response.status === 429 ? "rate-limit" : "upstream");
    let body: ExplorerPage<T>;
    try {
      body = await response.json() as ExplorerPage<T>;
    } catch {
      throw new RpcError("invalid explorer response", "invalid-response", "upstream");
    }
    const pageItems = Array.isArray(body.items) ? body.items : [];
    const blocks = pageItems.map((item) => (item as { block_number?: number }).block_number).filter((block): block is number => typeof block === "number");
    items.push(...pageItems.filter((item) => {
      const block = (item as { block_number?: number }).block_number;
      return typeof block === "number" && block >= fromBlock && block <= toBlock;
    }));
    if (!body.next_page_params || pageItems.length === 0 || (blocks.length > 0 && Math.min(...blocks) < fromBlock)) return items;
    if (page === robinhoodConfig.maxExplorerPages - 1) {
      throw new RpcError("address activity pagination limit reached", "page-limit", "upstream");
    }
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body.next_page_params)) {
      if (value !== null && value !== undefined) params.set(key, String(value));
    }
    const previousParams = new URL(url).searchParams;
    for (const [key, value] of previousParams) if (!params.has(key)) params.set(key, value);
    url = new URL(`${robinhoodConfig.explorerApiUrl}/addresses/${address}/${path}?${params.toString()}`);
  }
  return items;
}

export interface ScanProgress { done: number; total: number; found: number }

/**
 * Use indexed native transaction/trace records and indexed ERC-20 Transfer
 * logs. Standard JSON-RPC has no address-history method for native transfers.
 */
export async function getWalletTransactions(
  address: Address,
  window: ScanWindow,
  onProgress?: (progress: ScanProgress) => void,
  signal?: AbortSignal,
): Promise<TokenTransfer[]> {
  const wallet = address.toLowerCase() as Address;
  onProgress?.({ done: 0, total: 3, found: 0 });
  const [transactions, internal, logs] = await Promise.all([
    fetchActivityPages<ExplorerTransaction>(wallet, "transactions", window.fromBlock, window.toBlock, signal),
    fetchActivityPages<ExplorerInternalTransaction>(wallet, "internal-transactions", window.fromBlock, window.toBlock, signal),
    fetchActivityPages<ExplorerTokenTransfer>(wallet, "token-transfers?type=ERC-20", window.fromBlock, window.toBlock, signal),
  ]);
  onProgress?.({ done: 3, total: 3, found: transactions.length + internal.length + logs.length });
  const all = [
    ...transactions.map((item) => transferFromExplorerTransaction(item, wallet)),
    ...internal.map((item) => transferFromInternal(item, wallet)),
    ...logs.map((item) => transferFromTokenLog(item, wallet)),
  ].filter((item): item is TokenTransfer => item !== null);
  const unique = new Map(all.map((item) => [item.id, item]));
  return [...unique.values()].sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
}

export async function getWalletSnapshot(address: Address) {
  const [balance, nonce, code] = await Promise.all([
    robinhoodRpc<string>("eth_getBalance", [address, "latest"]),
    robinhoodRpc<string>("eth_getTransactionCount", [address, "latest"]),
    robinhoodRpc<string>("eth_getCode", [address, "latest"]),
  ]);
  return { balanceRaw: BigInt(balance), nonce: num(nonce), isContract: !!code && code !== "0x" };
}

export async function getAddressKinds(addresses: Address[]): Promise<Record<string, AddressKind>> {
  const out: Record<string, AddressKind> = {};
  await Promise.all(addresses.map(async (address) => {
    try {
      const code = await robinhoodRpc<string>("eth_getCode", [address, "latest"]);
      out[address] = code && code !== "0x" ? "contract" : "account";
    } catch {
      out[address] = "unknown";
    }
  }));
  return out;
}

export async function getTransaction(hash: Hex) {
  const [tx, receipt] = await Promise.all([
    robinhoodRpc<RawTx | null>("eth_getTransactionByHash", [hash]),
    robinhoodRpc<RawReceipt | null>("eth_getTransactionReceipt", [hash]),
  ]);
  if (!tx) return null;
  if (!receipt || !tx.blockNumber) return { tx, receipt: null, timestamp: null, latest: await getLatestBlock() };
  const [timestamp, latest] = await Promise.all([getBlockTimestamp(num(receipt.blockNumber)), getLatestBlock()]);
  return { tx, receipt, timestamp, latest };
}

export async function isContract(address: Address) {
  const kinds = await getAddressKinds([address]);
  return kinds[address] === "contract";
}

export const robinhoodTransferTopic = TRANSFER_TOPIC;
export type { RawLog };
