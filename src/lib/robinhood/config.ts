import "server-only";
import type { WindowKey } from "@/lib/types";
import { isWindowKey } from "@/lib/validate";

function urls() {
  const raw = process.env.ROBINHOOD_RPC_URLS;
  if (!raw) return ["https://rpc.testnet.chain.robinhood.com"];
  const configured = raw.split(",").map((value) => value.trim()).filter((value) => /^https?:\/\//.test(value));
  return configured.length ? configured : ["https://rpc.testnet.chain.robinhood.com"];
}

function int(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export const robinhoodConfig = {
  rpcUrls: urls(),
  concurrencyPerEndpoint: int("ROBINHOOD_RPC_CONCURRENCY", 2, 1, 16),
  minIntervalMs: int("ROBINHOOD_RPC_MIN_INTERVAL_MS", 250, 0, 5_000),
  requestTimeoutMs: int("ROBINHOOD_RPC_TIMEOUT_MS", 15_000, 1_000, 60_000),
  explorerApiUrl: (process.env.ROBINHOOD_EXPLORER_API_URL ?? "https://explorer.testnet.chain.robinhood.com/api/v2").replace(/\/$/, ""),
  maxExplorerPages: int("ROBINHOOD_MAX_EXPLORER_PAGES", 200, 1, 2_000),
  maxWindow: (isWindowKey(process.env.ROBINHOOD_MAX_WINDOW) ? process.env.ROBINHOOD_MAX_WINDOW : "3d") as WindowKey,
};
