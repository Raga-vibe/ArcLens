"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AddressLink, CopyButton, EmptyState, ExternalLink, KindTag } from "@/components/ui/primitives";
import { track } from "@/lib/analytics-events";
import { explorerBlockUrl, explorerTxUrl } from "@/lib/arc/chain";
import { formatDateTime, formatInt, formatUsd, formatUsdc, shortAddress } from "@/lib/format";
import type { ApiResponse, TransactionInsight } from "@/lib/types";

type State =
  | { status: "loading" }
  | { status: "ready"; data: TransactionInsight }
  | { status: "error"; code: string; message: string };

export function TxView({ hash }: { hash: string }) {
  const [retry, setRetry] = useState(0);
  const key = `${hash}|${retry}`;
  const [keyed, setKeyed] = useState<{ key: string; state: State }>({ key, state: { status: "loading" } });
  const state: State = keyed.key === key ? keyed.state : { status: "loading" };

  useEffect(() => {
    const ctrl = new AbortController();
    const setState = (next: State) => setKeyed({ key, state: next });
    track("transaction_analysis_started");
    fetch(`/api/tx/${hash}`, { signal: ctrl.signal })
      .then((r) => r.json() as Promise<ApiResponse<TransactionInsight>>)
      .then((j) => {
        if (j.ok) {
          setState({ status: "ready", data: j.data });
          track("transaction_analysis_completed", { status: j.data.status });
        } else setState({ status: "error", code: j.error.code, message: j.error.message });
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError")
          setState({ status: "error", code: "NETWORK", message: "Couldn't reach ArcLens. Check your connection and try again." });
      });
    return () => ctrl.abort();
  }, [hash, retry, key]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="border-b border-line pb-6">
        <p className="eyebrow mb-3">Transaction intelligence</p>
        <h1 className="break-all font-mono text-lg text-ink sm:text-2xl" title={hash}>
          <span className="sm:hidden">{shortAddress(hash, 12, 10)}</span>
          <span className="hidden sm:inline">{shortAddress(hash, 14, 12)}</span>
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CopyButton value={hash} label="Copy hash" />
          <a
            href={explorerTxUrl(hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-muted hover:border-line-strong hover:text-ink"
          >
            Arc Explorer ↗<span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </div>

      {state.status === "loading" && <TxSkeleton />}
      {state.status === "error" && (
        <div className="panel mt-8">
          <EmptyState
            icon="!"
            title={state.code === "NOT_FOUND" ? "Transaction not found on Arc mainnet" : state.code === "RATE_LIMITED" ? "Slow down a little" : "Couldn't analyze this transaction"}
            body={
              state.code === "NOT_FOUND"
                ? "Check that the hash is complete and that it's from Arc mainnet (not testnet or another chain)."
                : state.message
            }
            action={
              <div className="mt-2 flex gap-2">
                {state.code !== "NOT_FOUND" && (
                  <button type="button" onClick={() => setRetry((r) => r + 1)} className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-bg">
                    Try again
                  </button>
                )}
                <Link href="/" className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:text-ink">
                  New search
                </Link>
              </div>
            }
          />
        </div>
      )}
      {state.status === "ready" && <TxReport tx={state.data} />}
    </div>
  );
}

function TxSkeleton() {
  return (
    <div className="mt-8 space-y-4" role="status" aria-label="Loading transaction">
      <div className="skeleton h-32 rounded-[var(--radius)]" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="skeleton h-48 rounded-[var(--radius)]" />
        <div className="skeleton h-48 rounded-[var(--radius)]" />
      </div>
    </div>
  );
}

function TxReport({ tx }: { tx: TransactionInsight }) {
  const reduce = useReducedMotion();
  const usdc = tx.movements.filter((m) => m.token === "USDC");
  const ok = tx.status === "success";
  const headline = ok && usdc.length === 1 ? usdc[0] : null;

  const facts: [string, React.ReactNode][] = [
    ["Status", <span key="s" className={`inline-flex items-center gap-1.5 ${ok ? "text-good" : "text-bad"}`}><span aria-hidden="true">{ok ? "✓" : "✕"}</span>{ok ? "Success" : "Reverted"}</span>],
    ["Amount", usdc.length === 0 ? "No USDC moved" : usdc.length === 1 ? formatUsdc(usdc[0].value ?? 0) : `${formatInt(usdc.length)} legs · largest ${formatUsdc(Math.max(...usdc.map((m) => m.value ?? 0)))}`],
    ["Native value sent", formatUsdc(tx.value)],
    ["Token", usdc.length ? "USDC (native)" : tx.movements.length ? [...new Set(tx.movements.map((m) => m.token))].join(", ") : "None"],
    ["From", <span key="f" className="flex flex-wrap items-center gap-2"><AddressLink address={tx.from} full className="break-all text-xs" /><KindTag kind="unknown" label={tx.fromLabel} /></span>],
    [
      tx.contractCreated ? "Contract created" : "To",
      tx.contractCreated ? (
        <AddressLink key="c" address={tx.contractCreated} full className="break-all text-xs" />
      ) : tx.to ? (
        <span key="t" className="flex flex-wrap items-center gap-2"><AddressLink address={tx.to} full className="break-all text-xs" /><KindTag kind={tx.toIsContract ? "contract" : "account"} label={tx.toLabel} /></span>
      ) : (
        "—"
      ),
    ],
    ["Block", <ExternalLink key="b" href={explorerBlockUrl(tx.blockNumber)}><span className="font-mono">{formatInt(tx.blockNumber)}</span></ExternalLink>],
    ["Timestamp", formatDateTime(tx.timestamp)],
    ["Confirmations", `${formatInt(tx.confirmations)} (final on inclusion)`],
    ["Network", "Arc Mainnet · chain 5042"],
    ["Gas fee", `${formatUsd(tx.fee, { precise: true })} USDC`],
    ["Gas used", formatInt(tx.gasUsed)],
    ["Sender nonce", formatInt(tx.nonce)],
    ...(tx.methodSelector ? [["Method selector", <span key="m" className="font-mono">{tx.methodSelector}</span>] as [string, React.ReactNode]] : []),
    ["Logs emitted", formatInt(tx.logCount)],
  ];

  return (
    <div className="space-y-6 pt-6">
      <motion.section
        initial={{ opacity: 0, y: reduce ? 0 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="panel overflow-hidden"
        aria-labelledby="tx-story"
      >
        <div className="p-5 sm:p-7">
          <p id="tx-story" className="eyebrow mb-4">What happened</p>
          {headline ? (
            <div className="grid items-center gap-5 sm:grid-cols-[1fr_auto_1fr]">
              <Party label="From" address={headline.from} />
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="font-display text-4xl text-ink sm:text-5xl">{formatUsd(headline.value ?? 0)}</span>
                <span className="text-xs text-muted">USDC</span>
                <svg viewBox="0 0 120 12" className="w-28 text-accent" aria-hidden="true">
                  <motion.path
                    d="M2 6H114M108 1l6 5-6 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.9, delay: 0.2 }}
                  />
                </svg>
              </div>
              <Party label="To" address={headline.to} align="right" />
            </div>
          ) : null}
          <ul className={`${headline ? "mt-6 border-t border-line pt-5" : ""} space-y-2`}>
            {tx.explanation.map((line, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: reduce ? 0 : 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduce ? 0 : 0.15 + i * 0.08 }}
                className={i === 0 && !headline ? "font-display text-2xl leading-snug text-ink" : "text-[15px] leading-relaxed text-ink-2"}
              >
                {line}
              </motion.li>
            ))}
          </ul>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="panel" aria-labelledby="tx-facts">
          <h2 id="tx-facts" className="border-b border-line px-5 py-3.5 text-[15px] font-medium">Details</h2>
          <dl className="divide-y divide-line">
            {facts.map(([k, v]) => (
              <div key={k} className="grid gap-1 px-5 py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
                <dt className="text-xs text-muted sm:pt-0.5">{k}</dt>
                <dd className="min-w-0 text-sm text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="panel" aria-labelledby="tx-moves">
          <h2 id="tx-moves" className="border-b border-line px-5 py-3.5 text-[15px] font-medium">
            Token movements <span className="text-muted">({formatInt(tx.movements.length)})</span>
          </h2>
          {tx.movements.length === 0 ? (
            <EmptyState title="No token transfers" body="This transaction emitted no Transfer events." />
          ) : (
            <ol className="relative space-y-0 p-5">
              <span className="absolute bottom-8 left-[27px] top-8 w-px bg-line" aria-hidden="true" />
              {tx.movements.map((m) => (
                <li key={m.logIndex} className="relative flex gap-4 py-2.5">
                  <span className="relative z-10 mt-1 grid size-3.5 place-items-center rounded-full border border-line-strong bg-surface" aria-hidden="true">
                    <span className={`size-1.5 rounded-full ${m.recognised ? "bg-accent" : "bg-faint"}`} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">
                      {m.value !== null ? `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(m.value)} ${m.token}` : `${m.valueRaw} (raw units)`}
                      {!m.recognised && <span className="ml-2 text-xs text-muted">unrecognized token · <span className="font-mono">{shortAddress(m.tokenAddress)}</span></span>}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
                      <AddressLink address={m.from} className="text-xs" /> → <AddressLink address={m.to} className="text-xs" />
                      <span className="ml-1 font-mono text-faint">log #{m.logIndex}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <p className="text-xs leading-relaxed text-faint">
        Decoded from the transaction receipt via Arc mainnet JSON-RPC. USDC amounts use the native 18-decimal EIP-7708 Transfer logs. The mirrored
        6-decimal ERC-20 log is ignored to avoid double counting. Informational only.
      </p>
    </div>
  );
}

function Party({ label, address, align }: { label: string; address: string; align?: "right" }) {
  return (
    <div className={`min-w-0 rounded-lg border border-line bg-bg/40 p-4 ${align === "right" ? "sm:text-right" : ""}`}>
      <p className="eyebrow mb-2">{label}</p>
      <AddressLink address={address} className="text-sm" />
      <p className="mt-2 text-xs">
        <Link href={`/wallet/${address}`} className="text-muted hover:text-accent">Analyze wallet →</Link>
      </p>
    </div>
  );
}
