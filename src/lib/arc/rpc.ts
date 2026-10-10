import "server-only";
import { robinhoodConfig } from "@/lib/robinhood/config";
import { serverConfig } from "./config";

export class RpcError extends Error {
  constructor(
    message: string,
    public code: number | string,
    public kind: "rate-limit" | "range" | "not-found" | "upstream",
  ) {
    super(message);
  }
}

interface RpcClientConfig {
  rpcUrls: string[];
  concurrencyPerEndpoint: number;
  minIntervalMs: number;
  requestTimeoutMs: number;
}

interface Endpoint {
  url: string;
  active: number;
  nextSlot: number;
  cooldownUntil: number;
  waiters: (() => void)[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function classify(code: number | string, message: string): RpcError["kind"] {
  const lower = message.toLowerCase();
  if (code === -32005 || code === 429 || lower.includes("rate limit") || lower.includes("too many")) return "rate-limit";
  if (
    code === -32012 || code === 35 || lower.includes("range") || lower.includes("max results") ||
    lower.includes("too large") || lower.includes("limit exceeded")
  ) return "range";
  return "upstream";
}

/** Build an isolated JSON-RPC client for one network's server-only endpoints. */
export function createRpcClient(config: RpcClientConfig) {
  const endpoints: Endpoint[] = config.rpcUrls.map((url) => ({
    url, active: 0, nextSlot: 0, cooldownUntil: 0, waiters: [],
  }));
  let idSeq = 1;

  function pick(exclude?: Endpoint) {
    const now = Date.now();
    const pool = endpoints.filter((endpoint) => endpoint !== exclude || endpoints.length === 1);
    return pool.reduce((best, endpoint) => {
      const score = (item: Endpoint) => Math.max(item.cooldownUntil - now, 0) * 10 + item.active + item.waiters.length;
      return score(endpoint) < score(best) ? endpoint : best;
    }, pool[0]);
  }

  async function acquire(endpoint: Endpoint) {
    while (endpoint.active >= config.concurrencyPerEndpoint) {
      await new Promise<void>((resolve) => endpoint.waiters.push(resolve));
    }
    endpoint.active++;
    const now = Date.now();
    const start = Math.max(now, endpoint.nextSlot, endpoint.cooldownUntil);
    endpoint.nextSlot = start + config.minIntervalMs;
    if (start > now) await sleep(start - now);
  }

  function release(endpoint: Endpoint) {
    endpoint.active--;
    endpoint.waiters.shift()?.();
  }

  async function once<T>(endpoint: Endpoint, method: string, params: unknown[], signal?: AbortSignal): Promise<T> {
    await acquire(endpoint);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
      const onAbort = () => controller.abort();
      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: idSeq++, method, params }),
          signal: controller.signal,
          cache: "no-store",
        });
        if (response.status === 429) throw new RpcError("rate limited", 429, "rate-limit");
        if (!response.ok) throw new RpcError(`HTTP ${response.status}`, response.status, "upstream");
        const body = await response.json() as { result?: T; error?: { code: number; message: string } };
        if (body.error) throw new RpcError(body.error.message, body.error.code, classify(body.error.code, body.error.message ?? ""));
        return body.result as T;
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", onAbort);
      }
    } catch (error) {
      if (error instanceof RpcError) throw error;
      throw new RpcError((error as Error).message ?? "network error", "network", "upstream");
    } finally {
      release(endpoint);
    }
  }

  return async function rpc<T>(method: string, params: unknown[] = [], signal?: AbortSignal): Promise<T> {
    let last: RpcError | undefined;
    let previous: Endpoint | undefined;
    let failures = 0;
    for (let attempt = 0; attempt < 12; attempt++) {
      if (signal?.aborted) throw new RpcError("aborted", "aborted", "upstream");
      const endpoint = pick(previous);
      try {
        return await once<T>(endpoint, method, params, signal);
      } catch (error) {
        const rpcError = error as RpcError;
        last = rpcError;
        if (rpcError.kind === "range") throw rpcError;
        const backoff = Math.min(5_000, 400 * 2 ** Math.min(attempt, 4)) + Math.random() * 250;
        if (rpcError.kind === "rate-limit") endpoint.cooldownUntil = Date.now() + backoff;
        else {
          failures++;
          endpoint.cooldownUntil = Date.now() + 500;
          if (failures >= 4) break;
        }
        previous = endpoint;
        await sleep(rpcError.kind === "rate-limit" ? Math.min(backoff, 1_500) : 200 * failures);
      }
    }
    throw last ?? new RpcError("RPC unavailable", "unknown", "upstream");
  };
}

export const rpc = createRpcClient(serverConfig);
export const robinhoodRpc = createRpcClient(robinhoodConfig);
export const hex = (n: number) => `0x${n.toString(16)}`;
export const num = (h: string) => Number.parseInt(h, 16);
