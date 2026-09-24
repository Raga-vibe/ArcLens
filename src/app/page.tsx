import Link from "next/link";
import { HeroNetwork } from "@/components/landing/HeroNetwork";
import { LandingView } from "@/components/landing/LandingView";
import { LiveBlock } from "@/components/landing/LiveBlock";
import { ProofFacts } from "@/components/landing/ProofFacts";
import { Reveal } from "@/components/motion/Reveal";
import { AnalyzeInput } from "@/components/search/AnalyzeInput";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { EXAMPLE_ADDRESS } from "@/lib/site";

export default function Home() {
  return (
    <>
      <LandingView />
      <Header search={false} />
      <main id="main">
        <Hero />
        <Problem />
        <Reveals />
        <Showcase />
        <HowItWorks />
        <BuiltForArc />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-line">
      <div className="grid-bg pointer-events-none absolute inset-0 -z-20 opacity-60 [mask-image:radial-gradient(ellipse_at_70%_40%,black,transparent_70%)]" />
      <HeroNetwork className="absolute inset-0 -z-10 h-full w-full opacity-90" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-bg via-bg/80 to-transparent md:via-bg/60" />
      <div className="mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-7xl flex-col justify-center px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="eyebrow mb-6 flex items-center gap-3">
            <span className="h-px w-8 bg-accent/60" aria-hidden="true" />
            Arc Lens · On-chain intelligence
          </p>
          <h1 className="font-display text-[clamp(3rem,9vw,6.5rem)] leading-[0.92] tracking-[-0.02em] text-ink">
            See what’s happening <em className="text-accent">on Arc.</em>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-2 sm:text-xl">
            Turn raw Arc activity into clear, visual intelligence.
          </p>
          <div className="mt-10 max-w-xl">
            <AnalyzeInput size="hero" showExample />
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
            <LiveBlock />
            <span className="font-mono text-[11px] text-faint">CHAIN ID 5042 · USDC-NATIVE</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Reveal className="max-w-3xl">
      <p className="eyebrow mb-4">{eyebrow}</p>
      <h2 className="font-display text-[clamp(2.2rem,5vw,3.75rem)] leading-[1] tracking-[-0.015em]">{title}</h2>
      {children && <div className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-2">{children}</div>}
    </Reveal>
  );
}

function Problem() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-7xl gap-14 px-4 py-24 sm:px-6 grid-cols-1 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-32">
        <SectionHead
          eyebrow="01 · The problem"
          title={
            <>
              Blockchain data is readable.
              <br />
              <span className="text-muted">Understanding it is harder.</span>
            </>
          }
        >
          <p>
            Every transfer on Arc is public, but it arrives as hex: addresses, raw integers, block numbers.
            Answering a simple question like <em>“what has this wallet been doing?”</em> means reading hundreds of
            entries and doing the arithmetic yourself.
          </p>
          <p className="mt-4">ArcLens does that arithmetic and shows you the result.</p>
        </SectionHead>
        <Reveal delay={0.1}>
          <div className="relative">
            <figure className="panel overflow-hidden">
              <figcaption className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <span className="eyebrow">eth_getLogs · raw</span>
                <span className="font-mono text-[11px] text-faint">Arc mainnet</span>
              </figcaption>
              <pre className="scroll-x p-4 font-mono text-[11.5px] leading-relaxed text-muted">
{`{
  "address": "0xffff…fffe",
  "topics": [
    "0xddf252ad…523b3ef",
    "0x…e01aef079ed65f40d7e2e7d11f5279c5cfedc1c8",
    "0x…43d894e229a008c72e96872739719b9cfda941d5"
  ],
  "data": "0x…3a78a6bcce48348000",
  "blockNumber": "0x153ab77",
  "blockTimestamp": "0x6ab31a0d"
}`}
              </pre>
            </figure>
            <div className="relative -mt-6 ml-6 sm:ml-16">
              <div className="panel bg-elevated p-5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)]">
                <p className="eyebrow mb-2 text-accent">Read by ArcLens</p>
                <p className="text-[15px] leading-relaxed text-ink">
                  <span className="font-medium">1,078.605 USDC</span> moved from{" "}
                  <span className="font-mono text-[13px] text-ink-2">0xe01a…c1c8</span> to{" "}
                  <span className="font-mono text-[13px] text-ink-2">0x43d8…41d5</span> in block 22,260,599 at
                  00:15:09 UTC on 23 Sep 2026.
                </p>
              </div>
            </div>
            <p className="mt-3 text-right text-xs text-faint">
              A real EIP-7708 USDC transfer log from Arc mainnet, decoded.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const REVEALS = [
  {
    title: "Activity",
    body: "See when a wallet is actually active: hour by hour, day by day.",
    art: (
      <svg viewBox="0 0 120 48" className="h-12 w-full" aria-hidden="true">
        {[6, 14, 9, 22, 30, 18, 12, 36, 28, 16, 10, 20, 26, 8].map((v, i) => (
          <rect key={i} x={i * 8.5} y={48 - v} width="5" height={v} rx="1.5" fill="var(--series-in)" opacity={0.35 + (v / 36) * 0.65} />
        ))}
      </svg>
    ),
  },
  {
    title: "Flow",
    body: "Understand where value moves: what comes in, what goes out, and the net.",
    art: (
      <svg viewBox="0 0 120 48" className="h-12 w-full" fill="none" aria-hidden="true">
        <path d="M4 10C40 10 44 24 60 24" stroke="var(--series-in)" strokeWidth="5" strokeLinecap="round" opacity=".8" />
        <path d="M4 38C40 38 44 24 60 24" stroke="var(--series-in)" strokeWidth="2.5" strokeLinecap="round" opacity=".6" />
        <path d="M60 24C76 24 80 8 116 8" stroke="var(--series-out)" strokeWidth="4" strokeLinecap="round" opacity=".8" />
        <path d="M60 24C76 24 80 40 116 40" stroke="var(--series-out)" strokeWidth="2" strokeLinecap="round" opacity=".6" />
        <circle cx="60" cy="24" r="5" fill="var(--ink)" />
      </svg>
    ),
  },
  {
    title: "Counterparties",
    body: "See who interacts with the wallet, ranked by volume and frequency.",
    art: (
      <svg viewBox="0 0 120 48" className="h-12 w-full" aria-hidden="true">
        {[100, 72, 50, 34, 22].map((v, i) => (
          <rect key={i} x="0" y={i * 9.5 + 1} width={v * 1.18} height="6" rx="2" fill="var(--accent)" opacity={1 - i * 0.16} />
        ))}
      </svg>
    ),
  },
  {
    title: "Patterns",
    body: "Spot changes in behavior: bursts, concentration, period-over-period shifts.",
    art: (
      <svg viewBox="0 0 120 48" className="h-12 w-full" fill="none" aria-hidden="true">
        <path d="M2 38 L20 34 L36 36 L52 30 L66 32 L78 18 L92 12 L106 16 L118 6" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <line x1="66" x2="66" y1="2" y2="46" stroke="var(--line-strong)" strokeDasharray="3 3" />
        <circle cx="118" cy="6" r="3" fill="var(--accent)" />
      </svg>
    ),
  },
];

function Reveals() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:py-32">
        <SectionHead eyebrow="02 · Capabilities" title="What ArcLens reveals" />
        <ul className="mt-14 grid gap-px overflow-hidden rounded-[var(--radius)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {REVEALS.map((r, i) => (
            <Reveal as="li" key={r.title} delay={i * 0.06} className="group flex flex-col gap-8 bg-surface p-6 transition-colors duration-300 hover:bg-elevated">
              <div className="transition-transform duration-500 ease-[var(--ease-out)] group-hover:-translate-y-0.5">{r.art}</div>
              <div>
                <h3 className="text-lg font-medium text-ink">{r.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{r.body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Showcase() {
  // Interface preview: shapes only, no numbers. Real data lives behind the link.
  const bars = [4, 7, 5, 9, 14, 11, 8, 6, 10, 16, 22, 18, 12, 9, 7, 11, 15, 20, 26, 19, 13, 10, 8, 6];
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:py-32">
        <SectionHead eyebrow="03 · The report" title="One address. One page. The whole picture.">
          <p>
            A wallet report brings activity, flow, counterparties and transaction history together, with a
            written summary computed from the data itself.
          </p>
        </SectionHead>
        <Reveal delay={0.1} className="mt-14">
          <div className="panel relative overflow-hidden p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <span className="size-8 rounded-full bg-gradient-to-br from-accent/60 to-in/40" aria-hidden="true" />
                <div>
                  <p className="eyebrow">Wallet intelligence</p>
                  <p className="font-mono text-sm text-ink-2">0x····…····</p>
                </div>
              </div>
              <span className="rounded-full border border-line px-3 py-1 text-[11px] text-muted">Interface preview</span>
            </div>
            <div className="grid gap-4 pt-5 lg:grid-cols-[2fr_1fr]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
                  {["Transfers", "Volume", "Incoming", "Outgoing"].map((l) => (
                    <div key={l} className="bg-surface p-4">
                      <p className="eyebrow">{l}</p>
                      <div className="mt-3 h-6 w-2/3 rounded bg-elevated-2" />
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-line p-4">
                  <div className="flex h-40 items-end gap-[3px]" aria-hidden="true">
                    {bars.map((v, i) => (
                      <div key={i} className="flex flex-1 flex-col justify-end gap-[2px]">
                        <div className="rounded-t-[3px] bg-out/80" style={{ height: `${v * 1.6}px` }} />
                        <div className="rounded-b-[3px] bg-in/80" style={{ height: `${v * 2.4}px` }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-2 rounded-lg border border-line p-4">
                <p className="eyebrow mb-3">Top counterparties</p>
                {[92, 70, 54, 40, 31, 22].map((v, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="h-3 w-16 rounded bg-elevated-2" />
                    <span className="h-2 rounded-full bg-accent/70" style={{ width: `${v}%` }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-surface to-transparent" />
            <div className="absolute inset-x-0 bottom-6 flex justify-center">
              <Link
                href={`/wallet/${EXAMPLE_ADDRESS}`}
                className="rounded-[10px] border border-line-strong bg-elevated px-4 py-2.5 text-sm text-ink transition-colors hover:border-accent/60 hover:text-accent"
              >
                Open a live report on real Arc data →
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const STEPS = [
  ["Enter an Arc wallet", "Paste any 0x address, or a transaction hash."],
  ["ArcLens retrieves on-chain activity", "Directly from Arc mainnet over JSON-RPC, block range by block range."],
  ["The data is normalized and analyzed", "Native USDC Transfer logs are decoded, de-duplicated and aggregated."],
  ["ArcLens visualizes the result", "Charts, flow, heatmap, rankings, and a summary computed from the data."],
  ["You explore the wallet", "Filter, sort, expand, jump to counterparties, share the URL."],
];

function HowItWorks() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:py-32">
        <SectionHead eyebrow="04 · Method" title="How it works" />
        <ol className="mt-14 grid gap-px overflow-hidden rounded-[var(--radius)] border border-line bg-line md:grid-cols-5">
          {STEPS.map(([t, b], i) => (
            <Reveal as="li" key={t} delay={i * 0.06} className="relative bg-surface p-6">
              <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-6 text-base font-medium leading-snug text-ink">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{b}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

const ARC_FACTS = [
  ["USDC is the native gas token", "Value on Arc is denominated in dollars, so ArcLens can report activity in USDC directly, without price conversion."],
  ["Every USDC movement is a log", "Arc implements EIP-7708: native USDC transfers emit standard Transfer events from a system address. That's what ArcLens reads."],
  ["Deterministic finality", "Transactions are final when included. A report never shows activity that could later be reorganized away."],
  ["Standard EVM JSON-RPC", "ArcLens uses Arc's public RPC. No proprietary API, no keys, and the source can be swapped for an indexer."],
];

function BuiltForArc() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-7xl gap-14 px-4 py-24 sm:px-6 grid-cols-1 lg:grid-cols-[1fr_1.4fr] lg:py-32">
        <SectionHead eyebrow="05 · Network" title="Built for Arc">
          <p>
            Arc is an open Layer-1 where USDC is the native currency. That design makes a dollar-denominated view
            of on-chain activity unusually direct.
          </p>
          <p className="mt-4 text-sm text-muted">
            Source: <a className="underline underline-offset-4 hover:text-ink" href="https://docs.arc.io" target="_blank" rel="noopener noreferrer">docs.arc.io</a>
          </p>
        </SectionHead>
        <dl className="grid gap-px overflow-hidden rounded-[var(--radius)] border border-line bg-line sm:grid-cols-2">
          {ARC_FACTS.map(([t, b], i) => (
            <Reveal key={t} delay={i * 0.06} className="bg-surface p-6">
              <dt className="text-base font-medium text-ink">{t}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">{b}</dd>
            </Reveal>
          ))}
          <ProofFacts />
        </dl>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_65%)]" />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-28 text-center sm:px-6 lg:py-36">
        <Reveal>
          <h2 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-none tracking-[-0.015em]">
            Explore an Arc wallet.
          </h2>
        </Reveal>
        <Reveal delay={0.1} className="mt-10 w-full max-w-xl text-left">
          <AnalyzeInput size="hero" />
        </Reveal>
      </div>
    </section>
  );
}
