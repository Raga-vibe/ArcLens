import "server-only";
import { serverConfig } from "./config";

// Minimal JSON-RPC client with a per-endpoint throttle, failover and
// retry-on-rate-limit. Deliberately dependency-free.

export class RpcError extends Error {
  constructor(
    message: string,
    public code: number | string,
    public kind: "rate-limit" | "range" | "not-found" | "upstream",
  ) {
    super(message);
  }
}

interface Endpoint {
  url: string;
  active: number;
  nextSlot: number;
  cooldownUntil: number;
  waiters: (() => void)[];
}

const endpoints: Endpoint[] = serverConfig.rpcUrls.map((url) => ({
  url,
  active: 0,
  nextSlot: 0,
  cooldownUntil: 0,
  waiters: [],
}));

let idSeq = 1;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pick(exclude?: Endpoint): Endpoint {
  const now = Date.now();
  const pool = endpoints.filter((e) => e !== exclude || endpoints.length === 1);
  return pool.reduce((best, e) => {
    const score = (x: Endpoint) =>
      Math.max(x.cooldownUntil - now, 0) * 10 + x.active + x.waiters.length;
    return score(e) < score(best) ? e : best;
  }, pool[0]);
}

async function acquire(e: Endpoint) {
  while (e.active >= serverConfig.concurrencyPerEndpoint) {
    await new Promise<void>((r) => e.waiters.push(r));
  }
  e.active++;
  const now = Date.now();
  const start = Math.max(now, e.nextSlot, e.cooldownUntil);
  e.nextSlot = start + serverConfig.minIntervalMs;
  if (start > now) await sleep(start - now);
}

function release(e: Endpoint) {
  e.active--;
  e.waiters.shift()?.();
}

function classify(code: number | string, message: string): RpcError["kind"] {
  const m = message.toLowerCase();
  if (code === -32005 || code === 429 || m.includes("rate limit") || m.includes("too many"))
    return "rate-limit";
  if (
    code === -32012 ||
    code === 35 ||
    m.includes("range") ||
    m.includes("max results") ||
    m.includes("too large") ||
    m.includes("limit exceeded")
  )
    return "range";
  return "upstream";
}

async function once<T>(e: Endpoint, method: string, params: unknown[]): Promise<T> {
  await acquire(e);
  try {
    const res = await fetch(e.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: idSeq++, method, params }),
      signal: AbortSignal.timeout(serverConfig.requestTimeoutMs),
      cache: "no-store",
    });
    if (res.status === 429) throw new RpcError("rate limited", 429, "rate-limit");
    if (!res.ok) throw new RpcError(`HTTP ${res.status}`, res.status, "upstream");
    const body = (await res.json()) as {
      result?: T;
      error?: { code: number; message: string };
    };
    if (body.error) {
      const kind = classify(body.error.code, body.error.message ?? "");
      throw new RpcError(body.error.message, body.error.code, kind);
    }
    return body.result as T;
  } catch (err) {
    if (err instanceof RpcError) throw err;
    throw new RpcError((err as Error).message ?? "network error", "network", "upstream");
  } finally {
    release(e);
  }
}

/**
 * Call a JSON-RPC method with failover across configured endpoints. Range
 * errors are surfaced immediately (the caller should split the request).
 */
export async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  let last: RpcError | undefined;
  let prev: Endpoint | undefined;
  for (let attempt = 0; attempt < 6; attempt++) {
    const e = pick(prev);
    try {
      return await once<T>(e, method, params);
    } catch (err) {
      const re = err as RpcError;
      last = re;
      if (re.kind === "range") throw re;
      if (re.kind === "rate-limit") {
        e.cooldownUntil = Date.now() + 800 * (attempt + 1);
      } else {
        e.cooldownUntil = Date.now() + 400;
      }
      prev = e;
      await sleep(150 * (attempt + 1));
    }
  }
  throw last ?? new RpcError("RPC unavailable", "unknown", "upstream");
}

export const hex = (n: number) => `0x${n.toString(16)}`;
export const num = (h: string) => Number.parseInt(h, 16);
