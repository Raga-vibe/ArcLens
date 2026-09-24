import { keccak256, stringToBytes } from "viem";
import { describe, expect, it } from "vitest";
import { buildSnapshot, canonicalSnapshotJson, hashSnapshot } from "@/lib/analytics/snapshot";
import { calculateCounterpartyStats } from "@/lib/analytics/stats";
import { A, B, sampleWallet, T0, W } from "./fixtures";

const window = { key: "3d" as const, fromBlock: 100, toBlock: 200, fromTimestamp: T0, toTimestamp: T0 + 3 * 86400 };

describe("report snapshot", () => {
  const txs = sampleWallet();
  const cps = calculateCounterpartyStats(txs);
  const snap = buildSnapshot(5042, W.toUpperCase().replace("0X", "0x"), window, txs, cps);

  it("uses exact raw integer totals", () => {
    expect(snap.subject).toBe(W);
    expect(snap.inVolumeRaw).toBe((BigInt(350) * BigInt(10) ** BigInt(18)).toString());
    expect(snap.outVolumeRaw).toBe((BigInt(45) * BigInt(10) ** BigInt(18)).toString());
    expect(snap.transferCount).toBe(6);
    expect(snap.inCount).toBe(3);
    expect(snap.outCount).toBe(3);
    expect(snap.uniqueCounterparties).toBe(3);
    expect(snap.topCounterparties[0]).toEqual({ address: B, inRaw: (BigInt(200) * BigInt(10) ** BigInt(18)).toString(), outRaw: (BigInt(30) * BigInt(10) ** BigInt(18)).toString(), transfers: 2 });
    expect(snap.topCounterparties[1].address).toBe(A);
  });

  it("hashes the canonical JSON deterministically", () => {
    const again = buildSnapshot(5042, W, window, [...txs].reverse(), cps);
    expect(hashSnapshot(again)).toBe(hashSnapshot(snap));
    expect(hashSnapshot(snap)).toBe(keccak256(stringToBytes(canonicalSnapshotJson(snap))));
    expect(canonicalSnapshotJson(snap)).not.toMatch(/\s/);
  });

  it("changes the hash when any fact changes", () => {
    const other = buildSnapshot(5042, W, { ...window, toBlock: 201 }, txs, cps);
    expect(hashSnapshot(other)).not.toBe(hashSnapshot(snap));
    const fewer = buildSnapshot(5042, W, window, txs.slice(1), calculateCounterpartyStats(txs.slice(1)));
    expect(hashSnapshot(fewer)).not.toBe(hashSnapshot(snap));
  });
});
