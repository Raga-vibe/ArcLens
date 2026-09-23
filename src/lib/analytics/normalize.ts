import { NATIVE_DECIMALS, NATIVE_TRANSFER_EMITTER, TRANSFER_TOPIC } from "@/lib/arc/chain";
import type { Address, Hex, TokenTransfer, Transaction } from "@/lib/types";

/** Shape of an eth_getLogs entry (Arc RPCs add a non-standard blockTimestamp). */
export interface RawLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  blockTimestamp?: string;
  transactionHash: string;
  logIndex: string;
  removed?: boolean;
}

export function topicToAddress(topic: string): Address {
  return `0x${topic.slice(-40).toLowerCase()}` as Address;
}

export function addressToTopic(address: string): Hex {
  return `0x${address.slice(2).toLowerCase().padStart(64, "0")}` as Hex;
}

/**
 * Convert a raw integer amount to a JS number with at most 6 decimals of
 * precision — enough for USDC analytics without float drift from 18 decimals.
 */
export function toUnits(raw: bigint, decimals: number): number {
  if (decimals <= 6) return Number(raw) / 10 ** decimals;
  const scale = BigInt(10) ** BigInt(decimals - 6);
  return Number(raw / scale) / 1e6;
}

/**
 * Normalise an EIP-7708 native USDC Transfer log. Returns null for anything
 * that isn't one (wrong emitter/topic, malformed, removed) so bad upstream
 * data can never poison analytics.
 */
export function normalizeTransaction(
  log: RawLog,
  timestampFallback?: number,
): TokenTransfer | null {
  if (!log || log.removed) return null;
  if (log.address?.toLowerCase() !== NATIVE_TRANSFER_EMITTER) return null;
  if (!Array.isArray(log.topics) || log.topics.length !== 3) return null;
  if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) return null;
  if (!/^0x[0-9a-fA-F]*$/.test(log.data ?? "")) return null;

  let raw: bigint;
  try {
    raw = BigInt(log.data === "0x" ? 0 : log.data);
  } catch {
    return null;
  }
  const blockNumber = Number.parseInt(log.blockNumber, 16);
  const logIndex = Number.parseInt(log.logIndex, 16);
  const timestamp = log.blockTimestamp
    ? Number.parseInt(log.blockTimestamp, 16)
    : timestampFallback;
  if (!Number.isFinite(blockNumber) || !Number.isFinite(logIndex)) return null;
  if (timestamp === undefined || !Number.isFinite(timestamp)) return null;

  const txHash = log.transactionHash.toLowerCase() as Hex;
  return {
    id: `${txHash}:${logIndex}`,
    txHash,
    logIndex,
    blockNumber,
    timestamp,
    from: topicToAddress(log.topics[1]),
    to: topicToAddress(log.topics[2]),
    valueRaw: raw.toString(),
    value: toUnits(raw, NATIVE_DECIMALS),
    token: "USDC",
  };
}

/**
 * View transfers from the wallet's perspective. Self-transfers emit no
 * EIP-7708 log, so every transfer here is strictly incoming or outgoing.
 * Deduplicates by id and sorts newest first (block, then log index).
 */
export function toWalletTransactions(
  transfers: TokenTransfer[],
  wallet: string,
): Transaction[] {
  const w = wallet.toLowerCase();
  const seen = new Set<string>();
  const out: Transaction[] = [];
  for (const t of transfers) {
    if (seen.has(t.id)) continue;
    const isOut = t.from === w;
    const isIn = t.to === w;
    if (isOut === isIn) continue; // unrelated, or a self-transfer
    seen.add(t.id);
    out.push({
      ...t,
      direction: isIn ? "in" : "out",
      counterparty: isIn ? t.from : t.to,
    });
  }
  return out.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
}
