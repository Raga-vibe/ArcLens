import type { Metadata } from "next";
import { DeployRegistry } from "@/components/deploy/DeployRegistry";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";

export const metadata: Metadata = {
  title: "Deploy registry",
  description: "Deploy the ArcLensRegistry contract to Arc mainnet from your own wallet.",
  robots: { index: false, follow: false },
};

export default function DeployPage() {
  return (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="eyebrow mb-4">Builder tools</p>
        <h1 className="font-display text-5xl leading-none">Deploy the ArcLens registry</h1>
        <p className="mt-5 text-ink-2">
          This puts the <span className="font-mono text-sm">ArcLensRegistry</span> contract on Arc mainnet from your own browser wallet. The contract
          only stores report fingerprints. It has no owner and no fees, and it never holds funds. The source is in{" "}
          <span className="font-mono text-sm">contracts/ArcLensRegistry.sol</span>.
        </p>
        <DeployRegistry />
      </main>
      <Footer />
    </>
  );
}
