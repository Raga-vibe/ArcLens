import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { AnalyzeInput } from "@/components/search/AnalyzeInput";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";

export default function NotFound() {
  return (
    <>
      <Header search={false} />
      <main id="main" className="relative mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 py-24 text-center">
        <LogoMark size={48} className="mb-8 text-muted" />
        <p className="eyebrow mb-4">404 · Out of view</p>
        <h1 className="font-display text-5xl leading-none sm:text-6xl">Nothing to see here.</h1>
        <p className="mt-5 max-w-md text-ink-2">This page doesn&apos;t exist. Try analyzing an Arc address or transaction instead.</p>
        <div className="mt-10 w-full max-w-lg text-left">
          <AnalyzeInput size="hero" />
        </div>
        <Link href="/" className="mt-2 text-sm text-muted hover:text-ink">
          ← Back home
        </Link>
      </main>
      <Footer />
    </>
  );
}
