import { keccak256, stringToBytes, type Hex } from "viem";
import type { Counterparty, ScanWindow, Transaction } from "@/lib/types";

// A report snapshot is the canonical, reproducible core of a wallet report.
// Its keccak256 hash is what gets anchored on Arc. Amounts are exact raw
// 18-decimal integers (strings), so the hash never depends on float rounding.

export const SNAPSHOT_SCHEMA = "arclens.report.v1";

export interface ReportSnapshot {
  schema: typeof SNAPSHOT_SCHEMA;
  chainId: number;
  subject: string;
  fromBlock: number;
  toBlock: number;
  fromTimestamp: number;
  toTimestamp: number;
  transferCount: number;
  txCount: number;
  inCount: number;
  outCount: number;
  inVolumeRaw: string;
  outVolumeRaw: string;
  uniqueCounterparties: number;
  /** Top counterparties by volume, raw amounts. */
  topCounterparties: { address: string; inRaw: string; outRaw: string; transfers: number }[];
}

export function buildSnapshot(
  chainId: number,
  subject: string,
  window: ScanWindow,
  txs: Transaction[],
  counterparties: Counterparty[],
  topN = 5,
): ReportSnapshot {
  let inRaw = BigInt(0);
  let outRaw = BigInt(0);
  let inCount = 0;
  const perCp = new Map<string, { inRaw: bigint; outRaw: bigint; transfers: number }>();
  for (const t of txs) {
    const v = BigInt(t.valueRaw);
    const cp = perCp.get(t.counterparty) ?? { inRaw: BigInt(0), outRaw: BigInt(0), transfers: 0 };
    cp.transfers++;
    if (t.direction === "in") {
      inRaw += v;
      inCount++;
      cp.inRaw += v;
    } else {
      outRaw += v;
      cp.outRaw += v;
    }
    perCp.set(t.counterparty, cp);
  }
  return {
    schema: SNAPSHOT_SCHEMA,
    chainId,
    subject: subject.toLowerCase(),
    fromBlock: window.fromBlock,
    toBlock: window.toBlock,
    fromTimestamp: window.fromTimestamp,
    toTimestamp: window.toTimestamp,
    transferCount: txs.length,
    txCount: new Set(txs.map((t) => t.txHash)).size,
    inCount,
    outCount: txs.length - inCount,
    inVolumeRaw: inRaw.toString(),
    outVolumeRaw: outRaw.toString(),
    uniqueCounterparties: perCp.size,
    topCounterparties: counterparties.slice(0, topN).map((c) => {
      const p = perCp.get(c.address)!;
      return { address: c.address, inRaw: p.inRaw.toString(), outRaw: p.outRaw.toString(), transfers: p.transfers };
    }),
  };
}

/** Canonical JSON: keys in the fixed order above, no whitespace. */
export function canonicalSnapshotJson(s: ReportSnapshot): string {
  return JSON.stringify({
    schema: s.schema,
    chainId: s.chainId,
    subject: s.subject,
    fromBlock: s.fromBlock,
    toBlock: s.toBlock,
    fromTimestamp: s.fromTimestamp,
    toTimestamp: s.toTimestamp,
    transferCount: s.transferCount,
    txCount: s.txCount,
    inCount: s.inCount,
    outCount: s.outCount,
    inVolumeRaw: s.inVolumeRaw,
    outVolumeRaw: s.outVolumeRaw,
    uniqueCounterparties: s.uniqueCounterparties,
    topCounterparties: s.topCounterparties.map((c) => ({
      address: c.address,
      inRaw: c.inRaw,
      outRaw: c.outRaw,
      transfers: c.transfers,
    })),
  });
}

export function hashSnapshot(s: ReportSnapshot): Hex {
  return keccak256(stringToBytes(canonicalSnapshotJson(s)));
}
