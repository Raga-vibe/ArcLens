"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/ui/primitives";
import type { WindowKey } from "@/lib/types";
import { AnalysisLoader } from "./AnalysisLoader";
import { useWalletReport } from "./useWalletReport";
import { WalletDashboard, WalletHeader } from "./WalletDashboard";

export function WalletView({
  address,
  windows,
  initialWindow,
}: {
  address: string;
  windows: WindowKey[];
  initialWindow: WindowKey;
}) {
  const [window, setWindow] = useState<WindowKey>(initialWindow);
  const [retry, setRetry] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const state = useWalletReport(address, window, retry);

  function changeWindow(w: WindowKey) {
    setWindow(w);
    router.replace(w === "24h" ? pathname : `${pathname}?window=${w}`, { scroll: false });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <WalletHeader
        address={address}
        window={window}
        windows={windows}
        onWindow={changeWindow}
        report={state.status === "ready" ? state.report : null}
      />
      {/* No exit animations: they depend on rAF, which pauses in background tabs. */}
        {state.status === "loading" && (
          <motion.div key={`loading-${window}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <AnalysisLoader stage={state.stage} progress={state.progress} />
          </motion.div>
        )}
        {state.status === "error" && state.error && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="panel mt-8">
            <EmptyState
              icon={state.error.code === "RATE_LIMITED" ? "⏱" : "!"}
              title={
                state.error.code === "RATE_LIMITED"
                  ? "Slow down a little"
                  : state.error.code === "UPSTREAM_UNAVAILABLE"
                    ? "Arc data unavailable"
                    : state.error.code === "INVALID_ADDRESS"
                      ? "Invalid wallet address"
                      : "Analysis failed"
              }
              body={
                <>
                  {state.error.message}
                  {state.error.retryAfter ? ` (retry in ~${state.error.retryAfter}s)` : ""}
                </>
              }
              action={
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => setRetry((r) => r + 1)} className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-bg hover:bg-white">
                    Try again
                  </button>
                  <Link href="/" className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:text-ink">
                    New search
                  </Link>
                </div>
              }
            />
          </motion.div>
        )}
        {state.status === "ready" && state.report && (
          <motion.div key={`ready-${window}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <WalletDashboard report={state.report} />
          </motion.div>
        )}
    </div>
  );
}
