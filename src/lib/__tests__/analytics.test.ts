import { describe, expect, it } from "vitest";
import { normalizeTransaction, toUnits, toWalletTransactions } from "@/lib/analytics/normalize";
import {
  activeUnits,
  bucketFor,
  calculateActivityHeatmap,
  calculateCounterpartyStats,
  calculateTimeSeries,
  calculateVolumeStats,
  calculateWalletStats,
  comparePeriods,
  hhi,
  mean,
  median,
  topNShare,
} from "@/lib/analytics/stats";
import { generateWalletSummary, peakHourBand } from "@/lib/analytics/summary";
import { A, B, C, log, sampleWallet, T0, W } from "./fixtures";

describe("normalizeTransaction", () => {
  it("decodes an EIP-7708 native USDC transfer log", () => {
    const t = normalizeTransaction(log(A, W, 1078.605, 22260599, T0, 3))!;
    expect(t.from).toBe(A);
    expect(t.to).toBe(W);
    expect(t.value).toBe(1078.605);
    expect(t.valueRaw).toBe("1078605000000000000000");
    expect(t.blockNumber).toBe(22260599);
    expect(t.logIndex).toBe(3);
    expect(t.timestamp).toBe(T0);
  });

  it("rejects logs from the 6-decimal ERC-20 emitter (avoids double counting)", () => {
    expect(normalizeTransaction(log(A, W, 1, 1, T0, 0, { address: "0x3600000000000000000000000000000000000000" }))).toBeNull();
  });

  it("rejects malformed, removed, or non-Transfer logs", () => {
    expect(normalizeTransaction(log(A, W, 1, 1, T0, 0, { removed: true }))).toBeNull();
    expect(normalizeTransaction(log(A, W, 1, 1, T0, 0, { data: "0xZZ" }))).toBeNull();
    expect(normalizeTransaction(log(A, W, 1, 1, T0, 0, { topics: ["0xdead"] }))).toBeNull();
    // Missing timestamp and no fallback
    expect(normalizeTransaction(log(A, W, 1, 1, T0, 0, { blockTimestamp: undefined }))).toBeNull();
  });

  it("uses a fallback timestamp when the RPC omits blockTimestamp", () => {
    const t = normalizeTransaction(log(A, W, 1, 1, T0, 0, { blockTimestamp: undefined }), 42);
    expect(t?.timestamp).toBe(42);
  });

  it("converts 18-decimal values without float drift", () => {
    expect(toUnits(BigInt("1000000000000000000"), 18)).toBe(1);
    expect(toUnits(BigInt("123456789000000000000"), 18)).toBe(123.456789);
    expect(toUnits(BigInt(2500000), 6)).toBe(2.5);
  });
});

describe("toWalletTransactions", () => {
  it("assigns direction and counterparty, dedupes, sorts newest first", () => {
    const logs = [log(A, W, 10, 5, T0, 0), log(W, B, 4, 7, T0 + 10, 1), log(A, W, 10, 5, T0, 0), log(A, B, 99, 6, T0, 0)];
    const transfers = logs.map((l) => normalizeTransaction(l)!);
    const txs = toWalletTransactions(transfers, W.toUpperCase().replace("0X", "0x"));
    expect(txs).toHaveLength(2); // duplicate removed, unrelated A→B removed
    expect(txs[0].direction).toBe("out");
    expect(txs[0].counterparty).toBe(B);
    expect(txs[1].direction).toBe("in");
    expect(txs[1].counterparty).toBe(A);
  });
});

describe("basic statistics", () => {
  it("computes mean and median (odd/even/empty)", () => {
    expect(mean([])).toBeNull();
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(mean([1, 2, 3, 6])).toBe(3);
  });

  it("computes concentration metrics", () => {
    expect(topNShare([50, 30, 10, 10], 3)).toBeCloseTo(0.9);
    expect(topNShare([], 3)).toBeNull();
    expect(hhi([100])).toBe(1);
    expect(hhi([25, 25, 25, 25])).toBeCloseTo(0.25);
  });
});

describe("volume and counterparty aggregation", () => {
  const txs = sampleWallet();

  it("totals incoming and outgoing volume", () => {
    const v = calculateVolumeStats(txs);
    expect(v.inVolume).toBe(350);
    expect(v.outVolume).toBe(45);
    expect(v.totalVolume).toBe(395);
    expect(v.netFlow).toBe(305);
    expect(v.inCount).toBe(3);
    expect(v.outCount).toBe(3);
    expect(v.median).toBe(40); // [5,10,30,50,100,200]
    expect(v.average).toBeCloseTo(395 / 6);
    expect(v.largest?.value).toBe(200);
  });

  it("aggregates counterparties and ranks by volume", () => {
    const cps = calculateCounterpartyStats(txs, { [A]: "account" });
    expect(cps.map((c) => c.address)).toEqual([B, A, C]);
    const a = cps.find((c) => c.address === A)!;
    expect(a.txCount).toBe(3);
    expect(a.inVolume).toBe(150);
    expect(a.outVolume).toBe(5);
    expect(a.dominant).toBe("both");
    expect(a.kind).toBe("account");
    expect(cps.find((c) => c.address === C)!.dominant).toBe("out");
    expect(cps.find((c) => c.address === C)!.kind).toBe("unknown");
  });
});

describe("time grouping", () => {
  const txs = sampleWallet();

  it("buckets into hourly series including empty buckets", () => {
    const s = calculateTimeSeries(txs, T0, T0 + 3 * 86400 - 1, 3600);
    expect(s).toHaveLength(72);
    expect(s[2].count).toBe(2);
    expect(s[2].inCount).toBe(1);
    expect(s[2].outCount).toBe(1);
    expect(s[2].inVolume).toBe(50);
    expect(s[2].outVolume).toBe(30);
    expect(s.reduce((a, p) => a + p.count, 0)).toBe(6);
    expect(s[0].count).toBe(0);
  });

  it("ignores transactions outside the range and handles bad ranges", () => {
    expect(calculateTimeSeries(txs, T0, T0 + 3599, 3600).reduce((a, p) => a + p.count, 0)).toBe(0);
    expect(calculateTimeSeries(txs, 10, 5, 3600)).toEqual([]);
  });

  it("builds a UTC day × hour heatmap", () => {
    const h = calculateActivityHeatmap(txs);
    expect(h).toHaveLength(168);
    const cell = (day: number, hour: number) => h.find((c) => c.day === day && c.hour === hour)!;
    expect(cell(1, 2).count).toBe(2); // Monday 02:xx
    expect(cell(2, 21).volume).toBe(200); // Tuesday 21:00
    expect(h.reduce((a, c) => a + c.count, 0)).toBe(6);
  });

  it("counts active days and hours", () => {
    expect(activeUnits(sampleWallet())).toEqual({ activeDays: 3, activeHours: 5 });
  });

  it("chooses bucket sizes", () => {
    expect(bucketFor(86400)).toBe(3600);
    expect(bucketFor(30 * 86400)).toBe(6 * 3600);
    expect(bucketFor(90 * 86400)).toBe(86400);
  });

  it("finds the peak 4-hour band", () => {
    const band = peakHourBand(calculateActivityHeatmap(sampleWallet()));
    // 00–04 (01:00, 02:00, 02:01) and 18–22 (20:00, 21:00, 21:00) tie at 3; earliest wins.
    expect(band?.count).toBe(3);
    expect(band?.start).toBe(0);
    expect(band?.share).toBeCloseTo(0.5);
  });
});

describe("period comparison", () => {
  const txs = sampleWallet();
  it("compares the second half of a window with the first", () => {
    const start = T0;
    const end = T0 + 4 * 86400; // split at T0 + 2d
    const c = comparePeriods(txs, start, end)!;
    expect(c.previousCount).toBe(5);
    expect(c.currentCount).toBe(1);
    expect(c.countChange).toBeCloseTo(-0.8);
    expect(c.previousVolume).toBe(390);
    expect(c.currentVolume).toBe(5);
  });

  it("returns null change when the previous period is empty", () => {
    const c = comparePeriods(txs, T0 - 4 * 86400, T0 + 4 * 86400)!;
    expect(c.previousCount).toBe(0);
    expect(c.countChange).toBeNull();
  });

  it("returns null for windows shorter than two hours", () => {
    expect(comparePeriods(txs, T0, T0 + 3600)).toBeNull();
  });
});

describe("wallet stats and summary", () => {
  it("handles empty data without fabricating values", () => {
    const s = calculateWalletStats([], [], []);
    expect(s.transferCount).toBe(0);
    expect(s.average).toBeNull();
    expect(s.median).toBeNull();
    expect(s.firstActivity).toBeNull();
    expect(s.hhi).toBeNull();
    const window = { key: "24h" as const, fromBlock: 1, toBlock: 2, fromTimestamp: T0, toTimestamp: T0 + 86400 };
    const out = generateWalletSummary({ stats: s, window, comparison: null, heatmap: calculateActivityHeatmap([]), counterparties: [], transactions: [] });
    expect(out.insights).toEqual([]);
    expect(out.summary[0]).toMatch(/No USDC transfers/);
  });

  it("writes a summary whose numbers match the stats", () => {
    const txs = sampleWallet();
    const cps = calculateCounterpartyStats(txs);
    const series = calculateTimeSeries(txs, T0, T0 + 3 * 86400, 3600);
    const s = calculateWalletStats(txs, cps, series);
    expect(s.txCount).toBe(6);
    expect(s.uniqueCounterparties).toBe(3);
    expect(s.firstActivity).toBe(T0 + 3600);
    expect(s.inOutRatio).toBeCloseTo(350 / 45);
    const window = { key: "3d" as const, fromBlock: 100, toBlock: 200, fromTimestamp: T0, toTimestamp: T0 + 3 * 86400 };
    const { summary } = generateWalletSummary({
      stats: s,
      window,
      comparison: comparePeriods(txs, T0, T0 + 3 * 86400),
      heatmap: calculateActivityHeatmap(txs),
      counterparties: cps,
      transactions: txs,
    });
    expect(summary[0]).toContain("6 USDC transfers");
    expect(summary[0]).toContain("$395.00");
    expect(summary[0]).toContain("3 counterparties");
    expect(summary[1]).toContain("$350.00 came in");
    expect(summary[1]).toContain("$45.00 went out");
    // No attribution language, ever.
    expect(summary.join(" ")).not.toMatch(/whale|bot|smart money|bullish|belongs to/i);
  });
});
