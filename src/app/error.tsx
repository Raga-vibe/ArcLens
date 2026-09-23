"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="mx-auto flex min-h-[80vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="eyebrow mb-4">Something went wrong</p>
      <h1 className="font-display text-5xl leading-none">The lens slipped.</h1>
      <p className="mt-5 text-ink-2">An unexpected error occurred while rendering this page. Nothing was lost; you can try again.</p>
      <div className="mt-8 flex gap-3">
        <button type="button" onClick={reset} className="rounded-[10px] bg-ink px-4 py-2 text-sm font-medium text-bg hover:bg-white">
          Try again
        </button>
        <Link href="/" className="rounded-[10px] border border-line px-4 py-2 text-sm text-muted hover:text-ink">
          Go home
        </Link>
      </div>
    </main>
  );
}
