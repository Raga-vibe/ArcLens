"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { Fragment, useId, useMemo, useState } from "react";
import { AddressLink, CopyButton, DirectionBadge, EmptyState, ExternalLink, Segmented } from "@/components/ui/primitives";
import { explorerBlockUrl, explorerTxUrl } from "@/lib/arc/chain";
import { formatDateTime, formatInt, formatUsd, formatUsdc, shortAddress } from "@/lib/format";
import type { Transaction } from "@/lib/types";

type Filter = "all" | "in" | "out" | "large" | "recent";
type Sort = "date" | "amount";
const PAGE = 20;

export function TransactionExplorer({ data, total, analyzedAt }: { data: Transaction[]; total: number; analyzedAt: number }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("date");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const searchId = useId();
  const reduce = useReducedMotion();

  const largeThreshold = useMemo(() => {
    if (!data.length) return Infinity;
    const s = data.map((t) => t.value).sort((a, b) => a - b);
    return s[Math.floor(s.length * 0.9)] ?? Infinity;
  }, [data]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let r = data.filter((t) => {
      if (filter === "in" && t.direction !== "in") return false;
      if (filter === "out" && t.direction !== "out") return false;
      if (filter === "large" && t.value < largeThreshold) return false;
      if (filter === "recent" && t.timestamp < analyzedAt - 3600) return false;
      if (needle && !t.txHash.includes(needle) && !t.counterparty.includes(needle)) return false;
      return true;
    });
    if (sort === "amount") r = [...r].sort((a, b) => b.value - a.value);
    return r;
  }, [data, filter, sort, q, largeThreshold, analyzedAt]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const view = rows.slice(cur * PAGE, cur * PAGE + PAGE);

  if (!data.length) return <EmptyState title="No USDC activity found" body="No USDC transfers involving this address were recorded in the analyzed window." />;

  return (
    <div>
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="scroll-x -mx-1 px-1">
          <Segmented
            label="Filter transactions"
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setPage(0);
            }}
            options={[
              { value: "all", label: "All" },
              { value: "in", label: "Incoming" },
              { value: "out", label: "Outgoing" },
              { value: "large", label: "Large" },
              { value: "recent", label: "Recent" },
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={searchId} className="sr-only">Search by transaction hash or counterparty</label>
          <input
            id={searchId}
            value={q}
            onChange={(e) => {
              setQ(e.target.value.slice(0, 80));
              setPage(0);
            }}
            placeholder="Search hash or address…"
            spellCheck={false}
            className="h-8 w-full min-w-0 rounded-lg border border-line bg-bg px-3 font-mono text-xs text-ink placeholder:font-sans placeholder:text-faint focus:border-accent/50 focus:outline-none lg:w-56"
          />
          <Segmented
            label="Sort transactions"
            value={sort}
            onChange={(v) => {
              setSort(v);
              setPage(0);
            }}
            options={[
              { value: "date", label: "Newest" },
              { value: "amount", label: "Largest" },
            ]}
          />
        </div>
      </div>
      <p className="px-4 pb-3 text-xs text-muted sm:px-5">
        {filter === "large" && `Large = at or above the 90th percentile (${formatUsd(largeThreshold)}). `}
        {filter === "recent" && "Recent = within 1 hour of analysis. "}
        {total > data.length
          ? `Showing the ${formatInt(data.length)} most recent of ${formatInt(total)} transfers. Statistics above use all ${formatInt(total)}.`
          : `${formatInt(rows.length)} of ${formatInt(total)} transfers`}
      </p>

      {rows.length === 0 ? (
        <EmptyState title="No matching transfers" body="Try a different filter or search term." />
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="space-y-2 px-4 pb-3 sm:hidden">
            {view.map((t) => {
              const isOpen = open === t.id;
              return (
                <li key={t.id} className={`rounded-lg border border-line ${isOpen ? "bg-elevated" : "bg-bg/40"}`}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`txm-${t.id}`}
                    onClick={() => setOpen(isOpen ? null : t.id)}
                    className="flex w-full items-start justify-between gap-3 p-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <DirectionBadge d={t.direction} />
                        <span className="font-mono text-xs text-ink-2">{shortAddress(t.counterparty)}</span>
                      </span>
                      <span className="mt-1.5 block text-[11px] text-muted tabular">{formatDateTime(t.timestamp)}</span>
                    </span>
                    <span className={`shrink-0 tabular text-sm ${t.direction === "in" ? "text-ink" : "text-ink-2"}`}>
                      {t.direction === "in" ? "+" : "−"}
                      {formatUsd(t.value)}
                    </span>
                  </button>
                  {isOpen && (
                    <div id={`txm-${t.id}`} className="border-t border-line">
                      <TxDetail t={t} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="scroll-x hidden sm:block">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">USDC transfers for this address. Expand a row for full details.</caption>
              <thead className="border-y border-line text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2.5 pl-5 text-left font-normal">Date (UTC)</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-normal">Direction</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-normal">Amount</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-normal">Counterparty</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-normal">Transaction</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-normal">Status</th>
                  <th scope="col" className="w-10 px-3 py-2.5 pr-5"><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody>
                {view.map((t) => {
                  const isOpen = open === t.id;
                  return (
                    <Fragment key={t.id}>
                      <tr className={`border-b border-line transition-colors hover:bg-elevated ${isOpen ? "bg-elevated" : ""}`}>
                        <td className="whitespace-nowrap px-3 py-2.5 pl-5 text-xs text-ink-2 tabular">{formatDateTime(t.timestamp).replace(" UTC", "")}</td>
                        <td className="px-3 py-2.5"><DirectionBadge d={t.direction} /></td>
                        <td className={`whitespace-nowrap px-3 py-2.5 text-right tabular ${t.direction === "in" ? "text-ink" : "text-ink-2"}`}>
                          {t.direction === "in" ? "+" : "−"}
                          {formatUsd(t.value)}
                        </td>
                        <td className="px-3 py-2.5"><AddressLink address={t.counterparty} /></td>
                        <td className="px-3 py-2.5">
                          <Link href={`/tx/${t.txHash}`} className="font-mono text-[13px] text-muted hover:text-accent" title={t.txHash}>
                            {shortAddress(t.txHash, 8, 6)}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
                            <span className="size-1.5 rounded-full bg-good" aria-hidden="true" /> Success
                          </span>
                        </td>
                        <td className="px-3 py-2.5 pr-5 text-right">
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-controls={`tx-${t.id}`}
                            aria-label={isOpen ? "Hide details" : "Show details"}
                            onClick={() => setOpen(isOpen ? null : t.id)}
                            className="grid size-7 place-items-center rounded-md text-muted hover:bg-elevated-2 hover:text-ink"
                          >
                            <svg viewBox="0 0 12 12" className={`size-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} fill="none" aria-hidden="true">
                              <path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <tr id={`tx-${t.id}`} className="border-b border-line bg-elevated">
                            <td colSpan={7} className="p-0">
                              <motion.div
                                initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                                animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                                exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                className="overflow-hidden"
                              >
                                <TxDetail t={t} />
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <nav aria-label="Transaction pages" className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-muted sm:px-5">
            <span className="tabular">
              {formatInt(cur * PAGE + 1)}–{formatInt(Math.min(rows.length, cur * PAGE + PAGE))} of {formatInt(rows.length)}
            </span>
            <div className="flex gap-1">
              <button type="button" disabled={cur === 0} onClick={() => setPage(cur - 1)} className="rounded-md border border-line px-3 py-1.5 hover:text-ink disabled:opacity-40">
                Previous
              </button>
              <button type="button" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} className="rounded-md border border-line px-3 py-1.5 hover:text-ink disabled:opacity-40">
                Next
              </button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

function TxDetail({ t }: { t: Transaction }) {
  const items: [string, React.ReactNode][] = [
    ["Transaction hash", <span key="h" className="flex flex-wrap items-center gap-2"><span className="break-all font-mono text-xs text-ink-2">{t.txHash}</span><CopyButton value={t.txHash} /></span>],
    ["Timestamp", formatDateTime(t.timestamp)],
    ["Block", <ExternalLink key="b" href={explorerBlockUrl(t.blockNumber)}><span className="font-mono text-xs">{formatInt(t.blockNumber)}</span></ExternalLink>],
    ["From", <AddressLink key="f" address={t.from} full className="break-all text-xs" />],
    ["To", <AddressLink key="t" address={t.to} full className="break-all text-xs" />],
    ["Amount", formatUsdc(t.value)],
    ["Token", "USDC (native, EIP-7708 transfer log)"],
    ["Status", "Success: Transfer logs are only emitted by successful transactions"],
    ["Log index", <span key="l" className="font-mono text-xs">{t.logIndex}</span>],
  ];
  return (
    <div className="px-5 py-4">
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {items.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="eyebrow mb-1">{k}</dt>
            <dd className="text-sm text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        <Link href={`/tx/${t.txHash}`} className="text-accent hover:underline">Analyze transaction →</Link>
        <ExternalLink href={explorerTxUrl(t.txHash)}>View on Arc Explorer</ExternalLink>
      </div>
    </div>
  );
}
