import type { Metadata } from "next";
import { LegalPage } from "@/components/site/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms for using ArcLens, an experimental, informational analytics tool for the Arc blockchain.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="24 September 2026">
      <p>
        By using ArcLens you agree to these terms. If you don&apos;t agree, please don&apos;t use the site.
      </p>

      <h2>What ArcLens is</h2>
      <p>
        ArcLens provides <strong>informational blockchain analytics</strong>. It reads public data from the Arc blockchain and presents
        calculated statistics and visualizations. ArcLens is an <strong>experimental project</strong> built for the Arc Microgrants program.
        It is not a regulated financial service, and it is not affiliated with or endorsed by Arc Network Services LLC or Circle.
      </p>

      <h2>Not financial advice</h2>
      <p>
        Nothing on ArcLens is financial, investment, legal, or tax advice, or a recommendation to buy, sell, or hold any asset or to
        transact with any address. You are solely responsible for your own decisions.
      </p>

      <h2>Accuracy and availability</h2>
      <ul>
        <li>Data may be incomplete, delayed, or inaccurate, for example because of RPC-provider limits, network issues, or bugs.</li>
        <li>Reports cover a stated block range only, not necessarily an address&apos;s full history.</li>
        <li>The service may change, be rate-limited, or become unavailable at any time without notice.</li>
      </ul>

      <h2>No attribution</h2>
      <p>
        ArcLens does not claim that any address belongs to a particular person or organization. It only shows a name when that name comes
        from verified public information, such as Arc&apos;s official contract-address documentation. Labels like
        “Contract” or “Account” describe on-chain properties only.
      </p>

      <h2>On-chain anchors</h2>
      <p>
        Anchoring a report sends a transaction from your own wallet to the ArcLensRegistry contract on Arc mainnet. You pay the network fee,
        and the transaction is permanent and public. An anchor proves only that a report with a given fingerprint existed at a given block. It
        does not certify that the analysis is complete or correct, and it is not an endorsement of any address. The contract has no owner,
        charges no fee, and holds no funds.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Don&apos;t attempt to overload, scrape at scale, or bypass rate limits on ArcLens.</li>
        <li>Don&apos;t use ArcLens to harass, dox, or target individuals.</li>
        <li>Don&apos;t use ArcLens for anything unlawful.</li>
      </ul>

      <h2>Disclaimer and limitation of liability</h2>
      <p>
        ArcLens is provided “as is” and “as available”, without warranties of any kind. To the maximum extent permitted by law, the ArcLens
        authors are not liable for any loss or damage arising from your use of, or reliance on, the site or its data.
      </p>

      <h2>Third-party services</h2>
      <p>
        ArcLens links to and depends on third-party services (including Arc RPC providers and the Arc Explorer). Their terms and policies
        apply to your use of them.
      </p>

      <h2>Changes</h2>
      <p>These terms may be updated. The date at the top shows the latest version.</p>

      <h2>Contact</h2>
      <p>
        Questions? Open an issue on <a href={SITE.github} target="_blank" rel="noopener noreferrer">GitHub</a>
        {SITE.contactEmail ? (
          <>
            {" "}or email <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
          </>
        ) : null}
        .
      </p>
    </LegalPage>
  );
}
