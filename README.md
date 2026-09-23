# ArcLens

**See what's happening on Arc.**

ArcLens turns raw Arc mainnet activity into a visual, plain-English intelligence report. Paste a wallet address or a transaction hash,
and ArcLens reads the chain, does the arithmetic, and shows you what happened.

> Built for [Arc Microgrants](https://dorahacks.io/hackathon/arc-microgrants/detail). Informational analytics only, not financial advice.

---

## Problem
Every transfer on Arc is public, but it arrives as hex: topics, raw integers, block numbers. Explorers show individual records. To answer
*"what has this address been doing?"* you still have to read hundreds of entries and do the math yourself.

## Solution
ArcLens retrieves an address's USDC activity directly from Arc mainnet, normalizes it, computes statistics, and presents:

- **Headline stats**: transfers, transactions, USDC volume (in / out / net), unique counterparties, average and median transfer,
  largest transfer, first and latest activity, live balance, and all-time transactions sent.
- **Activity over time**: stacked in/out bars by hour, toggled between count and volume, with exact values on hover or keyboard focus.
- **Activity heatmap**: UTC weekday × hour.
- **Value flow**: top senders → wallet → top recipients, sized by volume.
- **Counterparties**: a ranked, sortable, filterable table. Every address links to its own report.
- **Transaction explorer**: search, filter (incoming / outgoing / large / recent), sort, paginate, and expand for full details.
- **Summary and insights**: sentences generated only from computed numbers (peak hours, concentration, skew, period-over-period change).
  No attribution, no speculation.
- **Transaction page**: status, USDC legs, other token transfer logs, gas fee in USDC, sender nonce, and finality.

## Why Arc
- USDC is Arc's native gas token, so activity is dollar-denominated with no price feed.
- Arc emits **EIP-7708** `Transfer` logs for every native USDC movement. ArcLens reads that stream and ignores the mirrored 6-decimal
  ERC-20 log to avoid double counting.
- Deterministic finality means closed block ranges never change, so ArcLens caches them indefinitely.

Details and sources: [`docs/arc-research.md`](docs/arc-research.md). Positioning: [`docs/hackathon-positioning.md`](docs/hackathon-positioning.md).

## Architecture
```
Browser (Next.js client components)
   │  fetch (same-origin only)
   ▼
API routes  /api/wallet/[address] (NDJSON stream) · /api/tx/[hash] · /api/status
   │  validation · per-IP rate limit · concurrency cap · safe error envelopes
   ▼
Report builder        src/lib/arc/report.ts
   ▼
Arc data provider     src/lib/arc/provider.ts   ← swap for an indexer here
   │  chunked eth_getLogs (EIP-7708 emitter 0xfff…fffe), LRU range cache
   ▼
JSON-RPC client       src/lib/arc/rpc.ts        ← throttle, failover, backoff
   ▼
Arc mainnet RPC (rpc.mainnet.arc.io, arc.drpc.org)

Pure analytics (unit-tested, no I/O):
  src/lib/analytics/normalize.ts   normalizeTransaction · toWalletTransactions
  src/lib/analytics/stats.ts       calculateWalletStats · calculateVolumeStats · calculateCounterpartyStats
                                   calculateTimeSeries · calculateActivityHeatmap · comparePeriods
  src/lib/analytics/summary.ts     generateWalletSummary
  src/lib/analytics/transaction.ts buildTransactionInsight · decodeMovements
```

## Tech stack
- **Next.js 16** (App Router, route handlers, streaming) and **TypeScript**
- **Tailwind CSS v4** with custom design tokens
- **motion** for purposeful animation (respects `prefers-reduced-motion`)
- **d3-scale / d3-shape** plus hand-built SVG charts (no heavy chart library)
- **Vitest** for unit tests
- No database, no wallet connection, no accounts

## Data sources
| Source | Used for |
| --- | --- |
| `https://rpc.mainnet.arc.io` (official Arc RPC) | Logs, balances, nonces, bytecode, transactions, receipts |
| `https://arc.drpc.org` (dRPC, a listed Arc node provider) | Fallback RPC |
| [docs.arc.io contract addresses](https://docs.arc.io/arc/references/contract-addresses) | The only source of named labels |

**Limitation:** public RPCs cap `eth_getLogs` at 10,000 blocks (~83 minutes) and are rate-limited, so the default deployment analyzes
**24h / 3d / 7d windows**. Every report states its exact block range. To analyze longer windows, point `ARC_RPC_URLS` at a provider that
supports larger log ranges, raise `ARC_LOG_BLOCK_RANGE`, and set `ARC_MAX_WINDOW`.

## Local setup
```bash
npm install
cp .env.example .env.local   # optional: every variable has a safe default
npm run dev                  # http://localhost:3000
```

Other scripts:
```bash
npm test          # unit tests (analytics + validation)
npm run lint
npm run typecheck
npm run build
```

## Environment variables
See [`.env.example`](.env.example).

| Variable | Scope | Default | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | public | `http://localhost:3000` | Canonical URL for metadata and sitemap |
| `NEXT_PUBLIC_GITHUB_URL`, `NEXT_PUBLIC_X_URL` | public | placeholders | Footer links |
| `NEXT_PUBLIC_CONTACT_EMAIL` | public | empty | Contact on legal pages |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | public | empty (off) | Optional cookieless analytics |
| `ARC_RPC_URLS` | **server** | Arc public + dRPC | Comma-separated RPC URLs (may contain keys) |
| `ARC_LOG_BLOCK_RANGE` | server | `10000` | Block span per `eth_getLogs` |
| `ARC_RPC_CONCURRENCY` / `ARC_RPC_MIN_INTERVAL_MS` | server | `2` / `220` | Throttling per endpoint |
| `ARC_MAX_WINDOW` | server | `7d` | Largest analysis window offered |
| `ARC_RATE_LIMIT_PER_MINUTE` | server | `12` | Analyses per IP per minute |

## Security notes
- No secrets in the frontend. RPC URLs are server-only, and the browser only talks to ArcLens's own origin (enforced by CSP
  `connect-src 'self'`).
- All inputs are validated before any network call (strict address and hash regexes, length caps, window allow-list).
- Upstream error text is never forwarded to clients. Responses use fixed, user-safe messages.
- Per-IP rate limiting and a per-instance concurrency cap on the expensive analysis endpoint. Scans stop when the client disconnects.
- Headers: CSP, `X-Frame-Options: DENY`, `nosniff`, strict `Referrer-Policy`, `Permissions-Policy`, HSTS.
- React escapes all rendered text, and there is no `dangerouslySetInnerHTML`.
- The rate limiter is in-memory (per instance). For multi-instance production, use a shared store.

## Privacy
No accounts, cookies, or database. Analytics are off by default, and if enabled they are cookieless and never include addresses or hashes.
See [`/privacy`](src/app/privacy/page.tsx).

## Deployment
Designed for Vercel (or any Node host):
1. Push to GitHub and import the repo in Vercel.
2. Set `NEXT_PUBLIC_SITE_URL` (and optionally the other public vars) in project settings.
3. Deploy. HTTPS is automatic.

`/api/wallet/*` streams for up to 120 s (`maxDuration`). Make sure your plan allows it.

## Screenshots
_Add after deployment: landing hero, wallet dashboard, flow diagram, transaction page._

## Demo
**Live:** https://arclens-three.vercel.app

## Hackathon
Submitted to **Arc Microgrants** on DoraHacks. See [`docs/hackathon-positioning.md`](docs/hackathon-positioning.md) for what's
implemented, what's experimental, and open questions.

## Future possibilities
- Indexer-backed full-history reports (Goldsky / Envio / Alchemy, all listed in Arc's docs)
- EURC and multi-token analytics
- Optional on-chain report attestation on Arc
- CSV / PNG export

## License
Not yet chosen. Add a `LICENSE` file before making the repo public. Fonts under `src/assets/fonts` are licensed under the SIL Open
Font License (see the license files there).
