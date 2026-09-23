import {
  DAY_NAMES,
  formatDateTime,
  formatDuration,
  formatHour,
  formatInt,
  formatPct,
  formatUsd,
  shortAddress,
} from "@/lib/format";
import type {
  ActivityHeatmapPoint,
  Counterparty,
  PeriodComparison,
  ScanWindow,
  Transaction,
  WalletInsight,
  WalletStats,
} from "@/lib/types";
import { sum } from "./stats";

// Every sentence produced here is a direct restatement of a computed number.
// No attribution, no intent, no predictions.

export interface SummaryInput {
  stats: WalletStats;
  window: ScanWindow;
  comparison: PeriodComparison | null;
  heatmap: ActivityHeatmapPoint[];
  counterparties: Counterparty[];
  transactions: Transaction[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${formatInt(n)} ${n === 1 ? one : many}`;

/** Most active contiguous band of `width` UTC hours (wrapping midnight). */
export function peakHourBand(heatmap: ActivityHeatmapPoint[], width = 4) {
  const byHour = Array.from({ length: 24 }, (_, h) =>
    sum(heatmap.filter((c) => c.hour === h).map((c) => c.count)),
  );
  const total = sum(byHour);
  if (!total) return null;
  let best = { start: 0, count: -1 };
  for (let s = 0; s < 24; s++) {
    let c = 0;
    for (let k = 0; k < width; k++) c += byHour[(s + k) % 24];
    if (c > best.count) best = { start: s, count: c };
  }
  return { ...best, end: (best.start + width) % 24, share: best.count / total, total };
}

export function peakWeekday(heatmap: ActivityHeatmapPoint[]) {
  const byDay = Array.from({ length: 7 }, (_, d) =>
    sum(heatmap.filter((c) => c.day === d).map((c) => c.count)),
  );
  const total = sum(byDay);
  if (!total) return null;
  const day = byDay.indexOf(Math.max(...byDay));
  return { day, count: byDay[day], share: byDay[day] / total };
}

export function generateWalletSummary(input: SummaryInput): {
  summary: string[];
  insights: WalletInsight[];
} {
  const { stats: s, window: w, comparison: cmp, heatmap, counterparties } = input;
  const span = formatDuration(w.toTimestamp - w.fromTimestamp);
  const range = `blocks ${formatInt(w.fromBlock)}–${formatInt(w.toBlock)}`;

  if (s.transferCount === 0) {
    return {
      summary: [
        `No USDC transfers involving this address were found in the analyzed window (${span}, ${range}).`,
      ],
      insights: [],
    };
  }

  const summary: string[] = [];
  summary.push(
    `Over the analyzed ${span} (${range}), this address recorded ${plural(s.transferCount, "USDC transfer")} in ${plural(s.txCount, "transaction")}, moving ${formatUsd(s.totalVolume)} with ${plural(s.uniqueCounterparties, "counterparty", "counterparties")}.`,
  );
  const inPart = s.inCount
    ? `${formatUsd(s.inVolume)} came in across ${plural(s.inCount, "transfer")}`
    : "nothing came in";
  const outPart = s.outCount
    ? `${formatUsd(s.outVolume)} went out across ${plural(s.outCount, "transfer")}`
    : "nothing went out";
  summary.push(
    `${inPart[0].toUpperCase()}${inPart.slice(1)}; ${outPart}. Net flow: ${s.netFlow >= 0 ? "+" : ""}${formatUsd(s.netFlow)}.`,
  );

  if (cmp && cmp.previousCount > 0 && cmp.currentCount > 0 && cmp.countChange !== null) {
    const pct = Math.round(Math.abs(cmp.countChange) * 100);
    if (pct === 0) {
      summary.push(`Transfer activity was flat between the two halves of the window.`);
    } else {
      summary.push(
        `Transfer count in the second half of the window (since ${formatDateTime(cmp.splitAt)}) was ${pct}% ${cmp.countChange > 0 ? "higher" : "lower"} than in the first half (${formatInt(cmp.currentCount)} vs ${formatInt(cmp.previousCount)}).`,
      );
    }
  } else if (cmp && cmp.previousCount === 0 && cmp.currentCount > 0) {
    summary.push(`All recorded transfers happened in the second half of the window.`);
  } else if (cmp && cmp.currentCount === 0 && cmp.previousCount > 0) {
    summary.push(`No transfers happened in the second half of the window (since ${formatDateTime(cmp.splitAt)}).`);
  }

  const insights: WalletInsight[] = [];

  const band = peakHourBand(heatmap);
  if (band && band.total >= 10 && band.share >= 0.35) {
    insights.push({
      id: "peak-hours",
      title: `Most active ${formatHour(band.start)}–${formatHour(band.end)} UTC`,
      body: `${formatPct(band.share)} of transfers (${formatInt(band.count)} of ${formatInt(band.total)}) happened in this 4-hour band.`,
      tone: "neutral",
      metric: formatPct(band.share),
    });
  }

  const wd = peakWeekday(heatmap);
  if (wd && s.activeDays >= 3 && s.transferCount >= 10 && wd.share >= 0.3) {
    insights.push({
      id: "peak-day",
      title: `${DAY_NAMES[wd.day]}s carry the most activity`,
      body: `${formatPct(wd.share)} of transfers in the window happened on a ${DAY_NAMES[wd.day]} (UTC).`,
      tone: "neutral",
      metric: formatPct(wd.share),
    });
  }

  const top = counterparties[0];
  if (top && counterparties.length > 1 && s.totalVolume > 0) {
    const share = top.totalVolume / s.totalVolume;
    if (share >= 0.5) {
      insights.push({
        id: "top-counterparty",
        title: "One counterparty dominates volume",
        body: `${shortAddress(top.address)} accounts for ${formatPct(share)} of all USDC volume (${formatUsd(top.totalVolume)}) in the window.`,
        tone: "notice",
        metric: formatPct(share),
      });
    }
  }

  if (s.top3OutShare !== null) {
    insights.push({
      id: "out-concentration",
      title: "Outgoing concentration",
      body: `The top 3 recipients received ${formatPct(s.top3OutShare)} of outgoing volume.`,
      tone: s.top3OutShare >= 0.8 ? "notice" : "neutral",
      metric: formatPct(s.top3OutShare),
    });
  }
  if (s.top3InShare !== null) {
    insights.push({
      id: "in-concentration",
      title: "Incoming concentration",
      body: `The top 3 senders provided ${formatPct(s.top3InShare)} of incoming volume.`,
      tone: s.top3InShare >= 0.8 ? "notice" : "neutral",
      metric: formatPct(s.top3InShare),
    });
  }

  if (s.average !== null && s.median !== null && s.median > 0 && s.transferCount >= 5) {
    const ratio = s.average / s.median;
    if (ratio >= 2) {
      insights.push({
        id: "skew",
        title: "A few large transfers drive volume",
        body: `The average transfer (${formatUsd(s.average)}) is ${ratio.toFixed(1)}× the median (${formatUsd(s.median)}).`,
        tone: "neutral",
        metric: `${ratio.toFixed(1)}×`,
      });
    }
  }

  if (s.largest && s.totalVolume > 0 && s.transferCount > 1) {
    const share = s.largest.value / s.totalVolume;
    insights.push({
      id: "largest",
      title: "Largest transfer",
      body: `${formatUsd(s.largest.value)} ${s.largest.direction === "in" ? "received" : "sent"} on ${formatDateTime(s.largest.timestamp)}: ${formatPct(share)} of window volume.`,
      tone: "neutral",
      metric: formatUsd(s.largest.value, { compact: true }),
    });
  }

  if (s.hourlyVolatility !== null && s.hourlyVolatility >= 1.5) {
    insights.push({
      id: "bursty",
      title: "Activity arrives in bursts",
      body: `Hourly transfer counts vary widely (coefficient of variation ${s.hourlyVolatility.toFixed(2)}). Activity is concentrated in a few hours of the window: ${formatInt(s.activeHours)} active hours in total.`,
      tone: "neutral",
      metric: s.hourlyVolatility.toFixed(2),
    });
  }

  if (cmp && cmp.volumeChange !== null && Math.abs(cmp.volumeChange) >= 0.25 && cmp.currentVolume > 0) {
    const up = cmp.volumeChange > 0;
    insights.push({
      id: "volume-trend",
      title: up ? "Volume increased" : "Volume decreased",
      body: `USDC volume in the second half of the window was ${formatUsd(cmp.currentVolume)}, versus ${formatUsd(cmp.previousVolume)} in the first half.`,
      tone: up ? "positive" : "negative",
      metric: `${up ? "+" : "−"}${Math.round(Math.abs(cmp.volumeChange) * 100)}%`,
    });
  }

  return { summary, insights };
}
