import Link from "next/link";
import { Wordmark } from "@/components/brand/Logo";
import { AnalyzeInput } from "@/components/search/AnalyzeInput";

export function Header({ search = true }: { search?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="ArcLens home" className="shrink-0 rounded">
          <Wordmark />
        </Link>
        <div className="flex-1" />
        {search && (
          <div className="hidden w-full max-w-md md:block">
            <AnalyzeInput size="compact" />
          </div>
        )}
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line px-2.5 py-1 text-[11px] text-muted">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-good/60 motion-reduce:hidden" />
            <span className="relative inline-flex size-1.5 rounded-full bg-good" />
          </span>
          Arc Mainnet
        </span>
      </div>
      {search && (
        <div className="border-t border-line px-4 py-2 md:hidden">
          <AnalyzeInput size="compact" />
        </div>
      )}
    </header>
  );
}
