"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/ui/primitives";
import type { WindowKey } from "@/lib/types";
import type { NetworkKey } from "@/lib/networks";
import { AnalysisLoader } from "./AnalysisLoader";
import { useWalletReport } from "./useWalletReport";
import { WalletDashboard, WalletHeader } from "./WalletDashboard";

export function WalletView({
  address,
  windowsByNetwork,
  initialWindow,
  network: initialNetwork,
  initialAsset,
}: {
  address: string;
  windowsByNetwork: Record<NetworkKey, WindowKey[]>;
  initialWindow: WindowKey;
  network: NetworkKey;
  initialAsset: string;
}) {
  const [window, setWindow] = useState<WindowKey>(initialWindow);
  const [network, setNetwork] = useState<NetworkKey>(initialNetwork);
  const [asset, setAsset] = useState(initialAsset);
  const windows = windowsByNetwork[network];
  const [retry, setRetry] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const state = useWalletReport(address, window, network, asset, retry);

  function replaceQuery(next: { window?: WindowKey; network?: NetworkKey; asset?: string }) {
    const params = new URLSearchParams();
    const nextWindow = next.window ?? window;
    const nextNetwork = next.network ?? network;
    const nextAsset = next.asset ?? asset;
    if (nextWindow !== "24h") params.set("window", nextWindow);
    if (nextNetwork !== "arc-mainnet") params.set("network", nextNetwork);
    if (nextAsset !== "native") params.set("asset", nextAsset);
    router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
  }

  function changeWindow(w: WindowKey) {
    setWindow(w);
    replaceQuery({ window: w });
  }

  function changeNetwork(next: NetworkKey) {
    const nextWindow = windowsByNetwork[next].includes(window) ? window : "24h";
    setNetwork(next);
    setWindow(nextWindow);
    setAsset("native");
    replaceQuery({ network: next, window: nextWindow, asset: "native" });
  }

  function changeAsset(next: string) {
    setAsset(next);
    replaceQuery({ asset: next });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <WalletHeader
        address={address}
        window={window}
        windows={windows}
        onWindow={changeWindow}
        network={network}
        onNetwork={changeNetwork}
        assetKey={asset}
        onAsset={changeAsset}
        report={state.status === "ready" ? state.report : null}
      />
      {/* No exit animations: they depend on rAF, which pauses in background tabs. */}
        {state.status === "loading" && (
          <motion.div key={`loading-${window}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <AnalysisLoader stage={state.stage} progress={state.progress} network={network} />
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
                    ? "Network data unavailable"
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
          <motion.div key={`ready-${network}-${window}-${asset}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <WalletDashboard report={state.report} />
          </motion.div>
        )}
    </div>
  );
}
