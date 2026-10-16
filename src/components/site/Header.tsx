import Link from "next/link";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand/Logo";
import { AnalyzeInput } from "@/components/search/AnalyzeInput";
import { NetworkSelector } from "@/components/site/NetworkSelector";
import { getNetwork, type NetworkKey } from "@/lib/networks";

export function Header({ search = true, network = "arc-mainnet" }: { search?: boolean; network?: NetworkKey }) {
  const currentNetwork = getNetwork(network);

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/75 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="ArcLens home" className="shrink-0 rounded transition-opacity hover:opacity-85">
          <Wordmark />
        </Link>
        <div className="flex-1" />
        {search && (
          <div className="hidden w-full max-w-md md:block">
            <AnalyzeInput size="compact" defaultNetwork={network} />
          </div>
        )}
        <Suspense
          fallback={
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface/80 px-2.5 py-1 text-[11px] text-muted">
              <span className="relative flex size-2">
                <span className="relative inline-flex size-2 rounded-full bg-good" />
              </span>
              {currentNetwork.name}
            </span>
          }
        >
          <NetworkSelector currentNetwork={network} />
        </Suspense>
      </div>
      {search && (
        <div className="border-t border-line/60 px-4 py-2 md:hidden bg-bg/90">
          <AnalyzeInput size="compact" defaultNetwork={network} />
        </div>
      )}
    </header>
  );
}
