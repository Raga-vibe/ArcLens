"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Hex } from "viem";
import { CopyButton, ExternalLink, Panel } from "@/components/ui/primitives";
import { track } from "@/lib/analytics-events";
import { canonicalSnapshotJson, hashSnapshot } from "@/lib/analytics/snapshot";
import { explorerAddressUrl, explorerTxUrl, REGISTRY_ADDRESS } from "@/lib/arc/chain";
import { registryAbi } from "@/lib/arc/registry-artifact";
import { formatInt, shortAddress } from "@/lib/format";
import type { WalletReport } from "@/lib/types";
import { connectArc, explainWalletError, hasWallet, readClient, walletClient } from "@/lib/wallet/arc-wallet";

interface Anchor {
  reportHash: Hex;
  anchoredBy: string;
  fromBlock: number;
  toBlock: number;
  anchoredAt: number;
}

type Step =
  | { s: "idle" }
  | { s: "connecting" }
  | { s: "confirm" }
  | { s: "pending"; tx: Hex }
  | { s: "done"; tx: Hex }
  | { s: "error"; message: string; tx?: Hex };

export function AnchorPanel({ report }: { report: WalletReport }) {
  const [step, setStep] = useState<Step>({ s: "idle" });
  const [anchors, setAnchors] = useState<{ total: number; list: Anchor[]; deployed: boolean; failed?: boolean } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const address = report.wallet.address;

  // Recompute the fingerprint in the browser: proves the snapshot and hash match.
  const localHash = useMemo(() => hashSnapshot(report.snapshot), [report.snapshot]);
  const intact = localHash === report.reportHash;

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/anchors/${address}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => setAnchors(j.ok ? { total: j.data.total, list: j.data.anchors, deployed: j.data.deployed } : { total: 0, list: [], deployed: false, failed: true }))
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setAnchors({ total: 0, list: [], deployed: false, failed: true });
      });
    return () => ctrl.abort();
  }, [address, refresh]);

  const live = anchors?.deployed === true;
  const alreadyAnchored = anchors?.list.some((a) => a.reportHash === report.reportHash) ?? false;

  const downloadSnapshot = useCallback(() => {
    const blob = new Blob([canonicalSnapshotJson(report.snapshot)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arclens-${address.slice(0, 10)}-${report.window.toBlock}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [report, address]);

  async function anchorOnArc() {
    if (!live) return;
    let tx: Hex | undefined;
    try {
      setStep({ s: "connecting" });
      const account = await connectArc();
      setStep({ s: "confirm" });
      tx = await walletClient(account).writeContract({
        address: REGISTRY_ADDRESS,
        abi: registryAbi,
        functionName: "anchor",
        args: [address, BigInt(report.window.fromBlock), BigInt(report.window.toBlock), report.reportHash],
      });
      setStep({ s: "pending", tx });
      const receipt = await readClient().waitForTransactionReceipt({ hash: tx, timeout: 120_000 });
      if (receipt.status !== "success") throw new Error("reverted");
      setStep({ s: "done", tx });
      track("share_report", { kind: "anchor" });
      setRefresh((r) => r + 1);
    } catch (e) {
      setStep({ s: "error", message: explainWalletError(e).message, tx });
    }
  }

  const busy = step.s === "connecting" || step.s === "confirm" || step.s === "pending";

  return (
    <Panel
      id="proof"
      title="Proof on Arc"
      eyebrow="On-chain anchor"
      description="Anchor this report's fingerprint on Arc mainnet so anyone can later verify it existed, unchanged, at a specific block."
    >
      <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="min-w-0 space-y-4">
          <div>
            <p className="eyebrow mb-1.5">Report fingerprint (keccak-256)</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="break-all font-mono text-xs text-ink-2">{report.reportHash}</code>
              <CopyButton value={report.reportHash} label="Copy" />
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
              <span aria-hidden="true" className={intact ? "text-good" : "text-bad"}>{intact ? "✓" : "✕"}</span>
              {intact
                ? "Recomputed in your browser from the snapshot: matches."
                : "Warning: the snapshot does not match the fingerprint."}
            </p>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            The fingerprint covers blocks {formatInt(report.window.fromBlock)}–{formatInt(report.window.toBlock)}: transfer counts,
            exact raw USDC totals and top counterparties. Download the snapshot and hash it with keccak-256 to check it against the
            chain yourself.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadSnapshot}
              className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              Download snapshot (JSON)
            </button>
            {live && (
              <button
                type="button"
                onClick={anchorOnArc}
                disabled={busy || alreadyAnchored || step.s === "done"}
                className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-bg transition-colors hover:bg-white disabled:opacity-60"
              >
                {step.s === "connecting"
                  ? "Connecting wallet…"
                  : step.s === "confirm"
                    ? "Confirm in your wallet…"
                    : step.s === "pending"
                      ? "Anchoring…"
                      : alreadyAnchored || step.s === "done"
                        ? "Anchored ✓"
                        : "Anchor on Arc"}
              </button>
            )}
          </div>
          <div aria-live="polite" className="text-xs">
            {anchors && !live && !anchors.failed && (
              <p className="text-muted">
                Anchoring switches on automatically once the ArcLensRegistry contract is deployed to its reserved address on Arc mainnet.
              </p>
            )}
            {live && step.s === "idle" && !alreadyAnchored && (
              <p className="text-muted">
                {hasWallet() ? "Costs a network fee of well under one cent in USDC, paid from your wallet." : "Needs a browser wallet (MetaMask, Rabby…) with a little USDC on Arc."}
              </p>
            )}
            {step.s === "pending" && (
              <p className="text-muted">
                Submitted. Waiting for inclusion… <ExternalLink href={explorerTxUrl(step.tx)}>View transaction</ExternalLink>
              </p>
            )}
            {step.s === "done" && (
              <p className="text-good">
                Anchored on Arc mainnet. <ExternalLink href={explorerTxUrl(step.tx)} className="text-good">View transaction</ExternalLink>
              </p>
            )}
            {step.s === "error" && (
              <p className="text-bad">
                {step.message} {step.tx && <ExternalLink href={explorerTxUrl(step.tx)}>View transaction</ExternalLink>}
              </p>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <p className="eyebrow mb-3">Anchored reports for this address</p>
          {anchors === null ? (
            <div className="skeleton h-16 rounded-md" />
          ) : !live && !anchors.failed ? (
            <p className="text-sm text-muted">Registry not deployed yet.</p>
          ) : anchors.failed ? (
            <p className="text-sm text-muted">Couldn&apos;t load anchors right now.</p>
          ) : anchors.list.length === 0 ? (
            <p className="text-sm text-muted">None yet. This would be the first.</p>
          ) : (
            <ul className="space-y-2">
              {anchors.list.map((a) => (
                <li key={a.reportHash} className="rounded-md border border-line bg-bg/40 p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-ink-2">{shortAddress(a.reportHash, 10, 8)}</code>
                    {a.reportHash === report.reportHash && <span className="text-good">This report</span>}
                  </div>
                  <p className="mt-1 text-muted">
                    Blocks {formatInt(a.fromBlock)}–{formatInt(a.toBlock)} · anchored in block {formatInt(a.anchoredAt)} by{" "}
                    <span className="font-mono">{shortAddress(a.anchoredBy)}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
          {(
            <p className="mt-3 text-xs text-muted">
              {live ? "Registry" : "Reserved registry address"}: <ExternalLink href={explorerAddressUrl(REGISTRY_ADDRESS)}><span className="font-mono">{shortAddress(REGISTRY_ADDRESS)}</span></ExternalLink>
              {anchors && anchors.total > anchors.list.length ? ` · showing ${anchors.list.length} of ${formatInt(anchors.total)}` : ""}
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
