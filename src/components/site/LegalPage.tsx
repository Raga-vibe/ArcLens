import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Header } from "./Header";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="eyebrow mb-4">Last updated {updated}</p>
        <h1 className="font-display text-5xl leading-none tracking-[-0.015em] sm:text-6xl">{title}</h1>
        <div className="legal mt-12 space-y-5 text-[15.5px] leading-relaxed text-ink-2 [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-12 [&_h2]:text-xl [&_h2]:font-medium [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_strong]:text-ink [&_ul]:space-y-2">
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}
