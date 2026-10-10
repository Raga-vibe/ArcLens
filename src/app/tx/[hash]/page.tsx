import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { TxView } from "@/components/tx/TxView";
import { EmptyState } from "@/components/ui/primitives";
import { shortAddress } from "@/lib/format";
import { isTxHash } from "@/lib/validate";
import { isNetworkKey } from "@/lib/networks";

export async function generateMetadata(props: PageProps<"/tx/[hash]">): Promise<Metadata> {
  const { hash } = await props.params;
  if (!isTxHash(hash)) return { title: "Invalid transaction", robots: { index: false } };
  const h = hash.toLowerCase();
  return {
    title: `Transaction ${shortAddress(h, 8, 6)}`,
    description: `Transaction details for ${h} on the selected network: status, value, parties and token movements.`,
    alternates: { canonical: `/tx/${h}` },
    robots: { index: false, follow: true },
  };
}

export default async function TxPage(props: PageProps<"/tx/[hash]">) {
  const { hash } = await props.params;
  const search = await props.searchParams;
  const rawNetwork = typeof search.network === "string" ? search.network : null;
  const network = isNetworkKey(rawNetwork) ? rawNetwork : "arc-mainnet";
  return (
    <>
      <Header />
      <main id="main" className="min-h-[70vh]">
        {isTxHash(hash) ? (
          <TxView hash={hash.toLowerCase()} network={network} />
        ) : (
          <div className="mx-auto max-w-xl px-4 py-24">
            <div className="panel">
              <EmptyState
                icon="!"
                title="That isn't a valid transaction hash."
                body={<>Transaction hashes start with <span className="font-mono">0x</span> followed by 64 hexadecimal characters.</>}
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
