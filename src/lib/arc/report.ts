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
  TokenTransfer,
  TransactionInsight,
  WalletReport,
  WindowKey,
} from "@/lib/types";
import { labelFor } from "./chain";
import { getNetwork, type NetworkKey, type WalletAsset } from "@/lib/networks";
import * as robinhood from "@/lib/robinhood/provider";
import { allowedWindows, serverConfig } from "./config";
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
  networkKey: NetworkKey = "arc-mainnet",
  requestedAsset = "native",
): Promise<WalletReport> {
  const cacheKey = `${networkKey}:${address}:${windowKey}:${requestedAsset}`;
  const hit = reportCache.get(cacheKey);
  if (hit && Date.now() - hit.at < REPORT_TTL_MS) return hit.report;
  const report = await computeWalletReport(address, windowKey, hooks, networkKey, requestedAsset);
  reportCache.set(cacheKey, { at: Date.now(), report });
  if (reportCache.size > 50) reportCache.delete(reportCache.keys().next().value!);
  return report;
}

async function computeWalletReport(
  address: Address,
  windowKey: WindowKey,
  hooks: ReportHooks,
  networkKey: NetworkKey,
  requestedAsset: string,
): Promise<WalletReport> {
  const chain = getNetwork(networkKey);
  const provider = networkKey === "arc-mainnet" ? {
    getLatestBlock,
    resolveWindow,
    getWalletSnapshot,
    getWalletTransactions,
    getAddressKinds,
  } : robinhood;
  hooks.stage?.("connect");
  const latest = await provider.getLatestBlock();
  const [window, account] = await Promise.all([
    provider.resolveWindow(windowKey, latest),
    provider.getWalletSnapshot(address),
  ]);

  hooks.stage?.("fetch");
  const transfers = await provider.getWalletTransactions(address, window, hooks.progress, hooks.signal);

  const availableAssets = getAvailableAssets(transfers, networkKey);
  const asset = availableAssets.find((item) => item.key === requestedAsset) ?? availableAssets[0];
  const assetTransfers = transfers.filter((item) => (item.assetKey ?? "native") === asset.key);

  hooks.stage?.("normalize");
  const transactions = toWalletTransactions(assetTransfers, address);

  hooks.stage?.("stats");
  const draft = calculateCounterpartyStats(transactions);
  const top = draft.slice(0, KIND_LOOKUPS).map((c) => c.address);
  const kinds = await provider.getAddressKinds(top);
  const labels: Record<string, AddressLabel | undefined> = {};
  if (networkKey === "arc-mainnet") for (const c of draft) labels[c.address] = labelFor(c.address);
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
    asset,
    network: networkKey,
  });

  const snapshot = buildSnapshot(chain.chainId, address, window, transactions, counterparties, 5, asset);

  return {
    network: networkKey,
    networkName: chain.name,
    asset,
    availableAssets,
    wallet: {
      address,
      isContract: account.isContract,
      label: networkKey === "arc-mainnet" ? labelFor(address) : undefined,
      balance: toUnits(account.balanceRaw, chain.nativeCurrency.decimals),
      balanceRaw: account.balanceRaw.toString(),
      balanceSymbol: chain.nativeCurrency.symbol,
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
      kind: networkKey === "arc-mainnet" ? "rpc-logs" : "indexed-transfers",
      description: networkKey === "arc-mainnet"
        ? "Arc mainnet JSON-RPC · EIP-7708 native USDC Transfer logs (emitter 0xfff…fffe)"
        : "Robinhood Chain Testnet explorer indexer · native ETH transactions and internal transfers, plus ERC-20 Transfer logs",
      maxWindow: allowedWindows(networkKey).at(-1) ?? serverConfig.maxWindow,
    },
    snapshot,
    reportHash: hashSnapshot(snapshot),
  };
}

function getAvailableAssets(transfers: TokenTransfer[], networkKey: NetworkKey): WalletAsset[] {
  const chain = getNetwork(networkKey);
  const native: WalletAsset = {
    key: "native", symbol: chain.nativeCurrency.symbol, decimals: chain.nativeCurrency.decimals,
    address: null, kind: "native",
  };
  const byKey = new Map<string, WalletAsset>([[native.key, native]]);
  for (const transfer of transfers) {
    const key = transfer.assetKey ?? "native";
    if (byKey.has(key)) continue;
    byKey.set(key, {
      key,
      symbol: transfer.token,
      decimals: transfer.decimals ?? 18,
      address: transfer.tokenAddress ?? null,
      kind: transfer.assetKind ?? (transfer.tokenAddress ? "erc20" : "native"),
    });
  }
  return [native, ...[...byKey.values()].filter((asset) => asset.key !== "native").sort((a, b) => a.symbol.localeCompare(b.symbol) || a.key.localeCompare(b.key))];
}

export async function buildTransactionReport(hash: Hex, networkKey: NetworkKey = "arc-mainnet"): Promise<TransactionInsight | null> {
  const provider = networkKey === "arc-mainnet" ? { getTransaction, getAddressKinds } : robinhood;
  const found = await provider.getTransaction(hash);
  if (!found || !found.receipt || found.timestamp === null) return null;
  const { tx, receipt, timestamp, latest } = found;
  const toIsContract = tx.to ? (await provider.getAddressKinds([tx.to.toLowerCase() as Address]))[tx.to.toLowerCase()] === "contract" : false;
  return buildTransactionInsight({ tx, receipt, timestamp, latest, toIsContract, network: networkKey });
}
