import "server-only";
import type { WindowKey } from "@/lib/types";
import { isWindowKey } from "@/lib/validate";

// Server-only configuration. RPC URLs may embed provider API keys, so they
// must never be exposed via NEXT_PUBLIC_* variables.

// Official public RPC (docs.arc.io). dRPC's free public endpoint also serves
// Arc, but (tested 2026-09-24) caps eth_getLogs below 1,000 blocks and omits
// blockTimestamp, which makes log scans slower. Add it via ARC_RPC_URLS only
// if you want extra failover.
const DEFAULT_RPCS = ["https://rpc.mainnet.arc.io"];

function int(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function urls(): string[] {
  const raw = process.env.ARC_RPC_URLS;
  if (!raw) return DEFAULT_RPCS;
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^https:\/\//.test(s));
  return list.length ? list : DEFAULT_RPCS;
}

export const serverConfig = {
  rpcUrls: urls(),
  /** Inclusive block span per eth_getLogs call. Public RPCs cap at 10,000. */
  logBlockRange: int("ARC_LOG_BLOCK_RANGE", 10_000, 100, 10_000_000),
  /** Parallel requests per RPC endpoint. */
  concurrencyPerEndpoint: int("ARC_RPC_CONCURRENCY", 3, 1, 32),
  /**
   * Minimum spacing between requests on one endpoint. The public Arc RPC
   * sustains ~2.5 req/s when paced evenly (measured); bursts get rate-limited.
   */
  minIntervalMs: int("ARC_RPC_MIN_INTERVAL_MS", 380, 0, 5_000),
  requestTimeoutMs: int("ARC_RPC_TIMEOUT_MS", 15_000, 1_000, 60_000),
  /** Largest scan window this deployment will serve. */
  maxWindow: (isWindowKey(process.env.ARC_MAX_WINDOW)
    ? process.env.ARC_MAX_WINDOW
    : "3d") as WindowKey,
  /** Wallet analyses per IP per minute. */
  rateLimitPerMinute: int("ARC_RATE_LIMIT_PER_MINUTE", 12, 1, 1_000),
};

/** Approximate block time: ~0.5 s (docs + measured). Only used to size windows. */
export const BLOCKS_PER_SECOND = 2;

export const WINDOW_SECONDS: Record<WindowKey, number | null> = {
  "24h": 86_400,
  "3d": 3 * 86_400,
  "7d": 7 * 86_400,
  "30d": 30 * 86_400,
  all: null,
};

const ORDER: WindowKey[] = ["24h", "3d", "7d", "30d", "all"];

export function allowedWindows(): WindowKey[] {
  return ORDER.slice(0, ORDER.indexOf(serverConfig.maxWindow) + 1);
}
