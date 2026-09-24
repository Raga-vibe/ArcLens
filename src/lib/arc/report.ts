import "server-only";
import { toWalletTransactions, toUnits } from "@/lib/analytics/normalize";
import {
  bucketFor,
  calculateActivityHeatmap,
  calculateCounterpartyStats,
  calculateTimeSeries,
  calculateWalletStats,
  comparePeriods,
} from "@/lib/analytics/stats";
import { generateWalletSummary } from "@/lib/analytics/summary";
import { buildSnapshot, hashSnapshot } from "@/lib/analytics/snapshot";
import { buildTransactionInsight } from "@/lib/analytics/transaction";
import type {
  Address,
  AnalysisStage,
  AddressLabel,
  Hex,
  TransactionInsight,
  WalletReport,
  WindowKey,
} from "@/lib/types";
import { ARC_MAINNET, labelFor } from "./chain";
import { serverConfig } from "./config";
import {
  getAddressKinds,
  getLatestBlock,
  getTransaction,
  getWalletSnapshot,
  getWalletTransactions,
  resolveWindow,
  type ScanProgress,
} from "./provider";

export interface ReportHooks {
  stage?: (s: AnalysisStage) => void;
  progress?: (p: ScanProgress) => void;
  signal?: AbortSignal;
}

/** Max counterparties we look up bytecode for (bounded RPC cost). */
const KIND_LOOKUPS = 12;
/** Payload caps: stats are computed on everything, only the view is capped. */
export const TX_PAYLOAD_LIMIT = 1_000;
export const COUNTERPARTY_PAYLOAD_LIMIT = 100;

/** Recently built reports, so reloads and shared links don't rescan. */
const REPORT_TTL_MS = 30_000;
const reportCache = new Map<string, { at: number; report: WalletReport }>();

export async function buildWalletReport(
  address: Address,
  windowKey: WindowKey,
  hooks: ReportHooks = {},
): Promise<WalletReport> {
  const cacheKey = `${address}:${windowKey}`;
  const hit = reportCache.get(cacheKey);
  if (hit && Date.now() - hit.at < REPORT_TTL_MS) return hit.report;
  const report = await computeWalletReport(address, windowKey, hooks);
  reportCache.set(cacheKey, { at: Date.now(), report });
  if (reportCache.size > 50) reportCache.delete(reportCache.keys().next().value!);
  return report;
}

async function computeWalletReport(
  address: Address,
  windowKey: WindowKey,
  hooks: ReportHooks,
): Promise<WalletReport> {
  hooks.stage?.("connect");
  const latest = await getLatestBlock();
  const [window, account] = await Promise.all([
    resolveWindow(windowKey, latest),
    getWalletSnapshot(address),
  ]);

  hooks.stage?.("fetch");
  const transfers = await getWalletTransactions(address, window, hooks.progress, hooks.signal);

  hooks.stage?.("normalize");
  const transactions = toWalletTransactions(transfers, address);

  hooks.stage?.("stats");
  const draft = calculateCounterpartyStats(transactions);
  const top = draft.slice(0, KIND_LOOKUPS).map((c) => c.address);
  const kinds = await getAddressKinds(top);
  const labels: Record<string, AddressLabel | undefined> = {};
  for (const c of draft) labels[c.address] = labelFor(c.address);
  const counterparties = calculateCounterpartyStats(transactions, kinds, labels);

  const span = window.toTimestamp - window.fromTimestamp;
  const bucketSeconds = bucketFor(span);
  const timeSeries = calculateTimeSeries(
    transactions,
    window.fromTimestamp,
    window.toTimestamp,
    bucketSeconds,
  );
  const heatmap = calculateActivityHeatmap(transactions);
  const stats = calculateWalletStats(transactions, counterparties, timeSeries);
  const comparison = comparePeriods(transactions, window.fromTimestamp, window.toTimestamp);

  hooks.stage?.("intelligence");
  const { summary, insights } = generateWalletSummary({
    stats,
    window,
    comparison,
    heatmap,
    counterparties,
    transactions,
  });

  const snapshot = buildSnapshot(ARC_MAINNET.chainId, address, window, transactions, counterparties);

  return {
    wallet: {
      address,
      isContract: account.isContract,
      label: labelFor(address),
      balance: toUnits(account.balanceRaw, 18),
      balanceRaw: account.balanceRaw.toString(),
      nonce: account.nonce,
    },
    window,
    latestBlock: latest,
    generatedAt: Math.floor(Date.now() / 1000),
    transactions: transactions.slice(0, TX_PAYLOAD_LIMIT),
    transactionsTotal: transactions.length,
    stats,
    counterparties: counterparties.slice(0, COUNTERPARTY_PAYLOAD_LIMIT),
    counterpartiesTotal: counterparties.length,
    timeSeries,
    bucketSeconds,
    heatmap,
    comparison,
    summary,
    insights,
    source: {
      kind: "rpc-logs",
      description:
        "Arc mainnet JSON-RPC · EIP-7708 native USDC Transfer logs (emitter 0xfff…fffe)",
      maxWindow: serverConfig.maxWindow,
    },
    snapshot,
    reportHash: hashSnapshot(snapshot),
  };
}

export async function buildTransactionReport(hash: Hex): Promise<TransactionInsight | null> {
  const found = await getTransaction(hash);
  if (!found || !found.receipt || found.timestamp === null) return null;
  const { tx, receipt, timestamp, latest } = found;
  const toIsContract = tx.to ? (await getAddressKinds([tx.to.toLowerCase() as Address]))[tx.to.toLowerCase()] === "contract" : false;
  return buildTransactionInsight({ tx, receipt, timestamp, latest, toIsContract });
}
