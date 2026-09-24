import type { Metadata } from "next";
import { LegalPage } from "@/components/site/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What ArcLens collects, what it doesn't, and which third parties are involved.",
  alternates: { canonical: "/privacy" },
};

const analyticsEnabled = !!process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="24 September 2026">
      <p>
        ArcLens is an experimental analytics tool for public data on the Arc blockchain. It is designed to collect as little as possible.
        There are no accounts and no sign-in, and you don&apos;t need to connect a wallet to use it.
      </p>

      <h2>What you submit</h2>
      <p>
        When you analyze a <strong>wallet address</strong> or <strong>transaction hash</strong>, that value is sent to the ArcLens server so
        it can query the Arc blockchain. It also appears in the page URL (for example <code>/wallet/0x…</code>) so reports can be shared.
        Wallet addresses and transaction hashes are public blockchain identifiers. ArcLens does not ask for, and does not want, your name,
        email, private keys, seed phrases, or any other personal information.
      </p>

      <h2>What ArcLens stores</h2>
      <ul>
        <li>
          <strong>No database.</strong> ArcLens does not keep a database of users, searches, or reports.
        </li>
        <li>
          <strong>Temporary in-memory cache.</strong> To reduce load on public infrastructure, the server may keep recently fetched
          blockchain data (public logs, block timestamps, contract/account checks) in memory. This is discarded when the server instance
          restarts.
        </li>
        <li>
          <strong>Rate limiting.</strong> To prevent abuse, the server counts requests per IP address in memory for about one minute. These
          counters are not written to disk or used for anything else.
        </li>
      </ul>

      <h2>Wallet connection and on-chain anchors (optional)</h2>
      <p>
        You can optionally connect a browser wallet to <strong>anchor a report on Arc</strong>. The connection happens entirely between
        your browser and your wallet. ArcLens never receives your private keys or seed phrase, and it never sends your wallet address to
        its server. If you approve an anchor transaction, the following becomes <strong>permanently public on the Arc blockchain</strong>:
        your wallet address (as the sender), the analyzed address, the report&apos;s block range, and the report fingerprint (a hash). Blockchain
        records can&apos;t be edited or deleted by ArcLens or anyone else. Only anchor if you&apos;re comfortable with that.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        ArcLens does not set cookies and does not use browser storage to track you. Because no non-essential cookies are used, there is no
        cookie banner.
      </p>

      <h2>Analytics</h2>
      {analyticsEnabled ? (
        <p>
          This deployment uses <a href="https://plausible.io/data-policy" target="_blank" rel="noopener noreferrer">Plausible Analytics</a>,
          a cookieless, privacy-focused service, to count page views and a few product events (for example “wallet analysis started”).
          Event data never includes wallet addresses or transaction hashes. Plausible does not use cookies or collect personal data.
        </p>
      ) : (
        <p>This deployment does not use any analytics service.</p>
      )}

      <h2>Third parties</h2>
      <ul>
        <li>
          <strong>Arc RPC.</strong> To answer your query, the ArcLens server sends the address or hash you submitted to Arc&apos;s public
          JSON-RPC endpoint (<code>rpc.mainnet.arc.io</code>). Your IP address is <em>not</em> forwarded: the RPC sees the ArcLens server,
          not you.
        </li>
        <li>
          <strong>Hosting.</strong> ArcLens is served by a hosting provider that, like any web server, processes standard request data
          (IP address, user agent, requested URL) to deliver the site and may keep short-lived operational logs under its own policy.
        </li>
        <li>
          <strong>Fonts.</strong> Fonts are self-hosted at build time. Your browser does not contact Google Fonts.
        </li>
        <li>
          <strong>Arc Explorer links.</strong> Links to <code>explorer.arc.io</code> open a third-party site with its own privacy policy.
        </li>
      </ul>

      <h2>Data retention</h2>
      <p>
        ArcLens retains no personal data. In-memory caches and rate-limit counters are temporary, as described above. Hosting-provider logs
        follow that provider&apos;s retention policy.
      </p>

      <h2>Your rights</h2>
      <p>
        Because ArcLens doesn&apos;t store personal data tied to you, there is generally nothing to access, correct, or delete. Blockchain data
        itself is public and permanent. ArcLens cannot change or remove anything recorded on Arc. If you have a privacy question or request,
        contact us below.
      </p>

      <h2>Contact</h2>
      <p>
        {SITE.contactEmail ? (
          <>
            Email <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>, or open an issue on{" "}
            <a href={SITE.github} target="_blank" rel="noopener noreferrer">GitHub</a>.
          </>
        ) : (
          <>
            Open an issue on the project&apos;s <a href={SITE.github} target="_blank" rel="noopener noreferrer">GitHub repository</a>.
          </>
        )}
      </p>

      <h2>Changes</h2>
      <p>If this policy changes, the date at the top of this page will be updated.</p>
    </LegalPage>
  );
}
