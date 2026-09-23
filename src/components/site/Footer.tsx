import Link from "next/link";
import { Wordmark } from "@/components/brand/Logo";
import { SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <Wordmark />
          <p className="max-w-sm text-sm text-muted">
            Built for Arc Microgrants. Informational analytics only, not financial advice.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <a className="hover:text-ink" href={SITE.github} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a className="hover:text-ink" href={SITE.x} target="_blank" rel="noopener noreferrer">
            X
          </a>
          <Link className="hover:text-ink" href="/privacy">
            Privacy
          </Link>
          <Link className="hover:text-ink" href="/terms">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
