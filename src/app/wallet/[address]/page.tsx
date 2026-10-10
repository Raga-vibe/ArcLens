import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { EmptyState } from "@/components/ui/primitives";
import { WalletView } from "@/components/wallet/WalletView";
import { allowedWindows } from "@/lib/arc/config";
import { shortAddress } from "@/lib/format";
import { isAddress, isWindowKey, normalizeAddress } from "@/lib/validate";
import { isNetworkKey } from "@/lib/networks";

export async function generateMetadata(props: PageProps<"/wallet/[address]">): Promise<Metadata> {
  const { address } = await props.params;
  if (!isAddress(address)) return { title: "Invalid address", robots: { index: false } };
  const a = normalizeAddress(address);
  return {
    title: `Wallet ${shortAddress(a)}`,
    description: `Wallet activity, value flow, counterparties and transaction history for ${a} on the selected network.`,
    alternates: { canonical: `/wallet/${a}` },
    // Reports are dynamic and per-address; keep them out of search indexes.
    robots: { index: false, follow: true },
    openGraph: { title: `Wallet ${shortAddress(a)} · ArcLens`, url: `/wallet/${a}` },
  };
}

export default async function WalletPage(props: PageProps<"/wallet/[address]">) {
  const { address } = await props.params;
  const sp = await props.searchParams;
  const rawNetwork = typeof sp.network === "string" ? sp.network : null;
  const network = isNetworkKey(rawNetwork) ? rawNetwork : "arc-mainnet";
  const windowsByNetwork = {
    "arc-mainnet": allowedWindows("arc-mainnet"),
    "robinhood-testnet": allowedWindows("robinhood-testnet"),
  };
  const windows = windowsByNetwork[network];
  const rawWindow = typeof sp.window === "string" ? sp.window : undefined;
  const initialWindow = isWindowKey(rawWindow) && windows.includes(rawWindow) ? rawWindow : "24h";
  const rawAsset = typeof sp.asset === "string" ? sp.asset : "native";
  const initialAsset = rawAsset === "native" || isAddress(rawAsset) ? rawAsset.toLowerCase() : "native";

  return (
    <>
      <Header />
      <main id="main" className="min-h-[70vh]">
        {isAddress(address) ? (
          <WalletView address={normalizeAddress(address)} windowsByNetwork={windowsByNetwork} initialWindow={initialWindow} network={network} initialAsset={initialAsset} />
        ) : (
          <div className="mx-auto max-w-xl px-4 py-24">
            <div className="panel">
              <EmptyState
                icon="!"
                title="Please enter a valid wallet address."
                body={
                  <>
                    Wallet addresses start with <span className="font-mono">0x</span> followed by 40 hexadecimal characters.
                  </>
                }
                action={
                  <Link href="/" className="mt-2 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-bg">
                    Back to search
                  </Link>
                }
              />
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
