"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics-events";
import type { AnalysisStage, ErrorResponse, WalletReport, WalletStreamEvent, WindowKey } from "@/lib/types";

export interface WalletState {
  status: "loading" | "ready" | "error";
  stage: AnalysisStage;
  progress: { done: number; total: number; found: number } | null;
  report: WalletReport | null;
  error: ErrorResponse["error"] | null;
}

const initial: WalletState = { status: "loading", stage: "connect", progress: null, report: null, error: null };

/** Consumes the NDJSON analysis stream from /api/wallet/[address]. */
export function useWalletReport(address: string, window: WindowKey, nonce = 0): WalletState {
  const [state, setState] = useState<WalletState>(initial);

  useEffect(() => {
    const ctrl = new AbortController();
    setState(initial);
    track("wallet_analysis_started", { window });
    const started = performance.now();

    (async () => {
      try {
        const res = await fetch(`/api/wallet/${address}?window=${window}`, { signal: ctrl.signal });
        if (!res.ok || !res.body) {
          let err: ErrorResponse["error"] = { code: "UPSTREAM_UNAVAILABLE", message: "Arc data is temporarily unavailable. Please try again shortly." };
          try {
            const j = (await res.json()) as ErrorResponse;
            if (j?.error) err = j.error;
          } catch {}
          setState((s) => ({ ...s, status: "error", error: err }));
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            const ev = JSON.parse(line) as WalletStreamEvent;
            if (ev.type === "stage") setState((s) => ({ ...s, stage: ev.stage }));
            else if (ev.type === "progress") setState((s) => ({ ...s, progress: { done: ev.done, total: ev.total, found: ev.found } }));
            else if (ev.type === "result") {
              track("wallet_analysis_completed", {
                window,
                transfers: ev.data.stats.transferCount > 0 ? "some" : "none",
                ms: Math.round(performance.now() - started),
              });
              setState((s) => ({ ...s, status: "ready", report: ev.data }));
            } else if (ev.type === "error") setState((s) => ({ ...s, status: "error", error: ev.error }));
          }
        }
        setState((s) =>
          s.status === "loading"
            ? { ...s, status: "error", error: { code: "INTERNAL", message: "The analysis ended unexpectedly. Please try again." } }
            : s,
        );
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setState((s) => ({
          ...s,
          status: "error",
          error: { code: "UPSTREAM_UNAVAILABLE", message: "Couldn't reach ArcLens. Check your connection and try again." },
        }));
      }
    })();

    return () => ctrl.abort();
  }, [address, window, nonce]);

  return state;
}
