import type {
  ActivityHeatmapPoint,
  AddressKind,
  AddressLabel,
  Counterparty,
  PeriodComparison,
  TimeSeriesPoint,
  Transaction,
  WalletStats,
} from "@/lib/types";

// Pure analytics. No I/O, no Date.now() — everything is a function of inputs
// so it can be tested with deterministic fixtures.

export function sum(xs: number[]) {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

export function mean(xs: number[]): number | null {
  return xs.length ? sum(xs) / xs.length : null;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function stdev(xs: number[]): number | null {
  const m = mean(xs);
  if (m === null) return null;
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / xs.length);
}

/** Share of `total` held by the largest `n` values (0–1). */
export function topNShare(values: number[], n: number): number | null {
  const total = sum(values);
  if (total <= 0) return null;
  const top = [...values].sort((a, b) => b - a).slice(0, n);
  return sum(top) / total;
}

/** Herfindahl–Hirschman index over shares (0–1). 1 = single counterparty. */
export function hhi(values: number[]): number | null {
  const total = sum(values);
  if (total <= 0) return null;
  return sum(values.map((v) => (v / total) ** 2));
}

export function calculateVolumeStats(txs: Transaction[]) {
  const values = txs.map((t) => t.value);
  const inTx = txs.filter((t) => t.direction === "in");
  const outTx = txs.filter((t) => t.direction === "out");
  const inVolume = sum(inTx.map((t) => t.value));
  const outVolume = sum(outTx.map((t) => t.value));
  let largest: Transaction | null = null;
  for (const t of txs) if (!largest || t.value > largest.value) largest = t;
  return {
    totalVolume: inVolume + outVolume,
    inVolume,
    outVolume,
    netFlow: inVolume - outVolume,
    inCount: inTx.length,
    outCount: outTx.length,
    average: mean(values),
    median: median(values),
    largest,
  };
}

export function calculateCounterpartyStats(
  txs: Transaction[],
  kinds: Record<string, AddressKind> = {},
  labels: Record<string, AddressLabel | undefined> = {},
): Counterparty[] {
  const map = new Map<string, Counterparty>();
  for (const t of txs) {
    let c = map.get(t.counterparty);
    if (!c) {
      c = {
        address: t.counterparty,
        kind: kinds[t.counterparty] ?? "unknown",
        label: labels[t.counterparty],
        txCount: 0,
        inCount: 0,
        outCount: 0,
        inVolume: 0,
        outVolume: 0,
        totalVolume: 0,
        firstSeen: t.timestamp,
        lastSeen: t.timestamp,
        dominant: t.direction,
      };
      map.set(t.counterparty, c);
    }
    c.txCount++;
    if (t.direction === "in") {
      c.inCount++;
      c.inVolume += t.value;
    } else {
      c.outCount++;
      c.outVolume += t.value;
    }
    c.totalVolume += t.value;
    c.firstSeen = Math.min(c.firstSeen, t.timestamp);
    c.lastSeen = Math.max(c.lastSeen, t.timestamp);
  }
  for (const c of map.values()) {
    c.dominant = c.inCount && c.outCount ? "both" : c.inCount ? "in" : "out";
  }
  return [...map.values()].sort(
    (a, b) => b.totalVolume - a.totalVolume || b.txCount - a.txCount || a.address.localeCompare(b.address),
  );
}

const HOUR = 3600;
const DAY = 86_400;

/**
 * Bucket transactions into fixed-width buckets covering [start, end].
 * Empty buckets are included so charts show gaps honestly.
 */
export function calculateTimeSeries(
  txs: Transaction[],
  start: number,
  end: number,
  bucketSeconds: number,
): TimeSeriesPoint[] {
  if (end < start || bucketSeconds <= 0) return [];
  const first = Math.floor(start / bucketSeconds) * bucketSeconds;
  const n = Math.floor((end - first) / bucketSeconds) + 1;
  const points: TimeSeriesPoint[] = Array.from({ length: n }, (_, i) => ({
    t: first + i * bucketSeconds,
    count: 0,
    inCount: 0,
    outCount: 0,
    volume: 0,
    inVolume: 0,
    outVolume: 0,
  }));
  for (const tx of txs) {
    const i = Math.floor((tx.timestamp - first) / bucketSeconds);
    const p = points[i];
    if (!p) continue;
    p.count++;
    p.volume += tx.value;
    if (tx.direction === "in") {
      p.inCount++;
      p.inVolume += tx.value;
    } else {
      p.outCount++;
      p.outVolume += tx.value;
    }
  }
  return points;
}

/** Pick a bucket width that keeps charts between ~24 and ~200 bars. */
export function bucketFor(spanSeconds: number) {
  if (spanSeconds <= 2 * DAY) return HOUR;
  if (spanSeconds <= 8 * DAY) return HOUR;
  if (spanSeconds <= 45 * DAY) return 6 * HOUR;
  return DAY;
}

/** 7×24 grid of UTC day-of-week × hour-of-day activity. */
export function calculateActivityHeatmap(txs: Transaction[]): ActivityHeatmapPoint[] {
  const grid: ActivityHeatmapPoint[] = [];
  for (let day = 0; day < 7; day++)
    for (let hour = 0; hour < 24; hour++) grid.push({ day, hour, count: 0, volume: 0 });
  for (const t of txs) {
    const d = new Date(t.timestamp * 1000);
    const cell = grid[d.getUTCDay() * 24 + d.getUTCHours()];
    cell.count++;
    cell.volume += t.value;
  }
  return grid;
}

/** Count distinct UTC days / hours with at least one transfer. */
export function activeUnits(txs: Transaction[]) {
  const days = new Set<number>();
  const hours = new Set<number>();
  for (const t of txs) {
    days.add(Math.floor(t.timestamp / DAY));
    hours.add(Math.floor(t.timestamp / HOUR));
  }
  return { activeDays: days.size, activeHours: hours.size };
}

/**
 * Compare the latest half of a window with the half before it.
 * Returns null if the window is too short to split meaningfully.
 */
export function comparePeriods(
  txs: Transaction[],
  start: number,
  end: number,
): PeriodComparison | null {
  if (end - start < 2 * HOUR) return null;
  const splitAt = start + Math.floor((end - start) / 2);
  const cur = txs.filter((t) => t.timestamp >= splitAt && t.timestamp <= end);
  const prev = txs.filter((t) => t.timestamp >= start && t.timestamp < splitAt);
  const change = (a: number, b: number) => (b > 0 ? (a - b) / b : null);
  const currentVolume = sum(cur.map((t) => t.value));
  const previousVolume = sum(prev.map((t) => t.value));
  return {
    currentCount: cur.length,
    previousCount: prev.length,
    currentVolume,
    previousVolume,
    countChange: change(cur.length, prev.length),
    volumeChange: change(currentVolume, previousVolume),
    splitAt,
  };
}

export function calculateWalletStats(
  txs: Transaction[],
  counterparties: Counterparty[],
  series: TimeSeriesPoint[],
): WalletStats {
  const v = calculateVolumeStats(txs);
  const { activeDays, activeHours } = activeUnits(txs);
  let first: number | null = null;
  let latest: number | null = null;
  for (const t of txs) {
    if (first === null || t.timestamp < first) first = t.timestamp;
    if (latest === null || t.timestamp > latest) latest = t.timestamp;
  }
  const outShares = counterparties.filter((c) => c.outVolume > 0).map((c) => c.outVolume);
  const inShares = counterparties.filter((c) => c.inVolume > 0).map((c) => c.inVolume);
  const counts = series.map((p) => p.count);
  const m = mean(counts);
  const sd = stdev(counts);
  return {
    transferCount: txs.length,
    txCount: new Set(txs.map((t) => t.txHash)).size,
    inCount: v.inCount,
    outCount: v.outCount,
    totalVolume: v.totalVolume,
    inVolume: v.inVolume,
    outVolume: v.outVolume,
    netFlow: v.netFlow,
    uniqueCounterparties: counterparties.length,
    firstActivity: first,
    latestActivity: latest,
    average: v.average,
    median: v.median,
    largest: v.largest,
    activeDays,
    activeHours,
    top3OutShare: outShares.length > 3 ? topNShare(outShares, 3) : null,
    top3InShare: inShares.length > 3 ? topNShare(inShares, 3) : null,
    hhi: hhi(counterparties.map((c) => c.totalVolume)),
    hourlyVolatility: m && sd !== null && txs.length >= 5 ? sd / m : null,
    inOutRatio: v.outVolume > 0 ? v.inVolume / v.outVolume : null,
  };
}
