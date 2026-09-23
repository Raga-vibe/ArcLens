"use client";

import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useState } from "react";
import { ActivityChart, ChartLegend, type SeriesMode } from "@/components/charts/ActivityChart";
import { FlowDiagram } from "@/components/charts/FlowDiagram";
import { Heatmap } from "@/components/charts/Heatmap";
import { CopyButton, CountUp, EmptyState, ExternalLink, KindTag, Panel, Segmented } from "@/components/ui/primitives";
import { track } from "@/lib/analytics-events";
import { explorerAddressUrl } from "@/lib/arc/chain";
import {
  formatDateTime,
  formatDuration,
  formatInt,
  formatPct,
  formatRelative,
  formatSignedPct,
  formatUsd,
  shortAddress,
} from "@/lib/format";
import type { WalletInsight, WalletReport, WindowKey } from "@/lib/types";
import { CounterpartyTable } from "./CounterpartyTable";
import { TransactionExplorer } from "./TransactionExplorer";

const WINDOW_LABEL: Record<WindowKey, string> = { "24h": "24H", "3d": "3D", "7d": "7D", "30d": "30D", all: "ALL" };

export function WalletHeader({
  address,
  window,
  windows,
  onWindow,
  report,
}: {
  address: string;
  window: WindowKey;
  windows: WindowKey[];
  onWindow: (w: WindowKey) => void;
  report: WalletReport | null;
}) {
  const [shared, setShared] = useState(false);
  return (
    <div className="flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className="eyebrow mb-3 flex items-center gap-2">
          Wallet intelligence
          {report?.wallet.isContract && <KindTag kind="contract" />}
          {report?.wallet.label && <KindTag kind="contract" label={report.wallet.label} />}
        </p>
        <h1 className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-2xl tracking-tight text-ink sm:text-3xl" title={address}>
            {shortAddress(address, 8, 6)}
          </span>
          <span className="sr-only">Full address: {address}</span>
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CopyButton value={address} label="Copy address" />
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${location.origin}/wallet/${address}?window=${window}`);
                setShared(true);
                track("share_report", { kind: "wallet" });
                setTimeout(() => setShared(false), 1400);
              } catch {}
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            {shared ? "Link copied" : "Share report"}
          </button>
          <a
            href={explorerAddressUrl(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            Arc Explorer ↗<span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </div>
      <div className="flex flex-col items-start gap-2 lg:items-end">
        <Segmented
          label="Analysis window"
          value={window}
          onChange={onWindow}
          options={windows.map((w) => ({ value: w, label: WINDOW_LABEL[w] }))}
        />
        {report && (
          <p className="text-xs text-muted lg:text-right">
            Blocks <span className="font-mono">{formatInt(report.window.fromBlock)}–{formatInt(report.window.toBlock)}</span>
            <br className="hidden lg:block" />
            <span className="lg:hidden"> · </span>
            {formatDateTime(report.window.fromTimestamp)} → {formatDateTime(report.window.toTimestamp)}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, children, sub, i }: { label: string; children: ReactNode; sub?: ReactNode; i: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: reduce ? 0 : i * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="bg-surface p-4 sm:p-5"
    >
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-2 text-[22px] leading-tight tracking-tight text-ink sm:text-[26px]">{children}</dd>
      {sub && <dd className="mt-1 text-xs text-muted">{sub}</dd>}
    </motion.div>
  );
}

export function WalletDashboard({ report }: { report: WalletReport }) {
  const [mode, setMode] = useState<SeriesMode>("count");
  const { stats: s, wallet, window: w, comparison: cmp } = report;
  const now = report.generatedAt;
  const money = (v: number) => formatUsd(v, { compact: v >= 1e6 });

  const statItems: { label: string; node: ReactNode; sub?: ReactNode; show: boolean }[] = [
    {
      label: "Transfers",
      node: <CountUp value={s.transferCount} format={formatInt} />,
      sub: `${formatInt(s.txCount)} transactions`,
      show: true,
    },
    { label: "USDC volume", node: <CountUp value={s.totalVolume} format={money} />, sub: `${formatInt(s.uniqueCounterparties)} counterparties`, show: true },
    { label: "Incoming ↓", node: <CountUp value={s.inVolume} format={money} />, sub: `${formatInt(s.inCount)} transfers`, show: true },
    { label: "Outgoing ↑", node: <CountUp value={s.outVolume} format={money} />, sub: `${formatInt(s.outCount)} transfers`, show: true },
    { label: "Unique counterparties", node: <CountUp value={s.uniqueCounterparties} format={formatInt} />, sub: s.hhi !== null ? `HHI ${s.hhi.toFixed(2)}` : undefined, show: true },
    { label: "Average transfer", node: s.average !== null ? formatUsd(s.average) : "—", sub: s.largest ? `Largest ${formatUsd(s.largest.value, { compact: true })}` : undefined, show: s.average !== null },
    { label: "Median transfer", node: s.median !== null ? formatUsd(s.median) : "—", show: s.median !== null },
    { label: "First activity", node: <span className="text-[17px] sm:text-lg">{s.firstActivity ? formatDateTime(s.firstActivity) : "—"}</span>, sub: "in window", show: s.firstActivity !== null },
    { label: "Latest activity", node: <span className="text-[17px] sm:text-lg">{s.latestActivity ? formatRelative(s.latestActivity, now) : "—"}</span>, sub: s.latestActivity ? formatDateTime(s.latestActivity) : undefined, show: s.latestActivity !== null },
    { label: "Current balance", node: <CountUp value={wallet.balance} format={money} />, sub: "USDC, live", show: true },
    { label: "Transactions sent", node: <CountUp value={wallet.nonce} format={formatInt} />, sub: "all-time (account nonce)", show: true },
    { label: "Active hours", node: <CountUp value={s.activeHours} format={formatInt} />, sub: `${formatInt(s.activeDays)} active UTC days`, show: true },
  ];

  const empty = s.transferCount === 0;

  return (
    <div className="space-y-6 pt-6">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-line bg-line md:grid-cols-3 xl:grid-cols-6">
        {statItems.filter((x) => x.show).map((x, i) => (
          <Stat key={x.label} label={x.label} sub={x.sub} i={i}>
            {x.node}
          </Stat>
        ))}
      </dl>

      <SummaryPanel report={report} />

      {empty ? (
        <Panel title="Activity" eyebrow="Time series">
          <EmptyState
            title="No USDC transfers in this window"
            body={
              <>
                ArcLens scanned blocks {formatInt(w.fromBlock)}–{formatInt(w.toBlock)} ({formatDuration(w.toTimestamp - w.fromTimestamp)}) and found no USDC
                transfers to or from this address. Try a longer window if available.
              </>
            }
          />
        </Panel>
      ) : (
        <>
          <Panel
            id="activity"
            title="Activity over time"
            eyebrow="Time series"
            description={`${report.bucketSeconds >= 86_400 ? "Daily" : report.bucketSeconds > 3600 ? `${report.bucketSeconds / 3600}-hour` : "Hourly"} buckets, UTC. ${cmp && cmp.countChange !== null ? `Second half vs first half: ${formatSignedPct(cmp.countChange)} transfers.` : ""}`}
            actions={
              <div className="flex flex-wrap items-center gap-4">
                <ChartLegend />
                <Segmented
                  label="Chart measure"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "count", label: "Transactions" },
                    { value: "volume", label: "Volume" },
                  ]}
                />
              </div>
            }
          >
            <div className="p-3 sm:p-5">
              <ActivityChart data={report.timeSeries} mode={mode} bucketSeconds={report.bucketSeconds} />
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_1fr]">
            <Panel id="flow" title="Value flow" eyebrow="Counterparty flow" description="Top senders → this wallet → top recipients. Width is proportional to USDC volume.">
              <div className="p-4 sm:p-5">
                <FlowDiagram
                  counterparties={report.counterparties}
                  inTotal={s.inVolume}
                  outTotal={s.outVolume}
                  inCount={s.inCount}
                  outCount={s.outCount}
                />
              </div>
            </Panel>
            <Panel id="heatmap" title="When this wallet is active" eyebrow="Activity heatmap" description="Transfers by UTC weekday and hour across the analyzed window.">
              <div className="p-4 sm:p-5">
                <Heatmap data={report.heatmap} />
              </div>
            </Panel>
          </div>

          <Panel id="counterparties" title="Counterparties" eyebrow="Ranked">
            <CounterpartyTable data={report.counterparties} total={report.counterpartiesTotal} />
          </Panel>

          <Panel id="transactions" title="Transactions" eyebrow="Explorer">
            <TransactionExplorer data={report.transactions} total={report.transactionsTotal} analyzedAt={report.generatedAt} />
          </Panel>
        </>
      )}

      <p className="pb-4 text-xs leading-relaxed text-faint">
        Source: {report.source.description}. Amounts are native USDC (18-decimal) values from on-chain logs. Contract/Account tags come from
        on-chain bytecode checks. Named labels only come from Arc&apos;s official contract list. ArcLens doesn&apos;t attribute addresses to people or
        organizations. Informational only; not financial advice.
      </p>
    </div>
  );
}

const TONE: Record<WalletInsight["tone"], { cls: string; icon: string; label: string }> = {
  neutral: { cls: "text-accent", icon: "◆", label: "Observation" },
  notice: { cls: "text-warn", icon: "▲", label: "Notable" },
  positive: { cls: "text-good", icon: "↗", label: "Increase" },
  negative: { cls: "text-bad", icon: "↘", label: "Decrease" },
};

function SummaryPanel({ report }: { report: WalletReport }) {
  const reduce = useReducedMotion();
  const { summary, insights, stats: s } = report;
  const extras: { k: string; v: string }[] = [];
  if (s.inOutRatio !== null) extras.push({ k: "In/out ratio", v: `${s.inOutRatio.toFixed(2)}×` });
  if (s.top3OutShare !== null) extras.push({ k: "Top-3 recipient share", v: formatPct(s.top3OutShare) });
  if (s.top3InShare !== null) extras.push({ k: "Top-3 sender share", v: formatPct(s.top3InShare) });
  if (s.hourlyVolatility !== null) extras.push({ k: "Hourly volatility (CV)", v: s.hourlyVolatility.toFixed(2) });
  if (s.transferCount) extras.push({ k: "Net flow", v: `${s.netFlow >= 0 ? "+" : ""}${formatUsd(s.netFlow)}` });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
      <section aria-labelledby="summary-title" className="panel p-5 sm:p-6">
        <p className="eyebrow mb-3">Activity summary</p>
        <h2 id="summary-title" className="sr-only">Activity summary</h2>
        <div className="space-y-3">
          {summary.map((line, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: reduce ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 0.2 + i * 0.12, duration: 0.5 }}
              className={i === 0 ? "font-display text-[22px] leading-snug text-ink sm:text-[26px]" : "text-[15px] leading-relaxed text-ink-2"}
            >
              {line}
            </motion.p>
          ))}
        </div>
        {extras.length > 0 && (
          <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-3 border-t border-line pt-4">
            {extras.map((e) => (
              <div key={e.k}>
                <dt className="text-[11px] text-muted">{e.k}</dt>
                <dd className="font-mono text-sm text-ink tabular">{e.v}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
      <section aria-labelledby="insights-title" className="panel p-5 sm:p-6">
        <p id="insights-title" className="eyebrow mb-4">Statistical insights</p>
        {insights.length === 0 ? (
          <p className="text-sm text-muted">Not enough activity in this window to derive reliable patterns.</p>
        ) : (
          <ul className="space-y-4">
            {insights.slice(0, 5).map((ins, i) => {
              const t = TONE[ins.tone];
              return (
                <motion.li
                  key={ins.id}
                  initial={{ opacity: 0, x: reduce ? 0 : 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: reduce ? 0 : 0.3 + i * 0.08, duration: 0.45 }}
                  className="flex gap-3"
                >
                  <span className={`mt-0.5 text-xs ${t.cls}`} aria-hidden="true">{t.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline justify-between gap-3 text-sm font-medium text-ink">
                      <span>
                        <span className="sr-only">{t.label}: </span>
                        {ins.title}
                      </span>
                      {ins.metric && <span className="shrink-0 font-mono text-xs text-muted">{ins.metric}</span>}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{ins.body}</p>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export function ExternalExplorer({ address }: { address: string }) {
  return <ExternalLink href={explorerAddressUrl(address)}>Arc Explorer</ExternalLink>;
}
