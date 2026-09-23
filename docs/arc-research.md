# Arc research notes

Researched on **2026-09-23**. Every value below was either read from an official source (linked) or
verified directly against the live network. Where something could not be verified, it says so.

---

## 1. Network status

| Item | Value | Source / verification |
| --- | --- | --- |
| Mainnet status | **Live** ("Arc mainnet is live", Sep 16) | [docs.arc.io](https://docs.arc.io/) · [DoraHacks program page](https://dorahacks.io/hackathon/arc-microgrants/detail) |
| Mainnet chain ID | **5042** (`0x13b2`) | [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc) · verified with `eth_chainId` on 2026-09-23 |
| Testnet chain ID | 5042002 | [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc) |
| Mainnet RPC (official) | `https://rpc.mainnet.arc.io` | [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc) · verified |
| Mainnet explorer | `https://explorer.arc.io` (Blockscout) | [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc) · verified (page title "Arc Mainnet … Blockscout") |
| Native gas token | USDC, **18 decimals** on the native interface | [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc) |
| Block time | ~0.5 s (testnet Blockscout reports `average_block_time: 500`) | `explorer.testnet.arc.io/api/v2/stats`; mainnet block timestamps agree (≈2 blocks/s) |
| Finality | Deterministic, instant. A transaction is final when it's included in a block | [EVM differences](https://docs.arc.io/arc/references/evm-differences) |
| Timestamps | Non-decreasing but not strictly increasing, with 1 s granularity. **Order by block number, not timestamp** | [EVM differences](https://docs.arc.io/arc/references/evm-differences) |

Mainnet block 1 has timestamp 2026-05-15. The chain existed before the public launch on Sep 16 but was
nearly empty; for example, block 1,000,000 contains 0 transactions.

## 2. Contract addresses (mainnet)

From [Contract addresses](https://docs.arc.io/arc/references/contract-addresses):

| Asset | Address | Decimals |
| --- | --- | --- |
| USDC (ERC-20 interface of the native token) | `0x3600000000000000000000000000000000000000` | 6 (ERC-20 view) / 18 (native) |
| EURC | `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1` | 6 |
| USYC | `0x8a5D989Bbb96929F689B0200f435f53dA42bF490` | 6 |
| cirBTC | `0x171A4217b86A807A64eB94757Db6849fb4bDbAA0` | 8 |
| WETH | `0x128cC466B61f542da60c70e3aA11c10e19B84EDB` | 18 |

## 3. How USDC movement shows up on-chain (critical for ArcLens)

From [USDC system events](https://docs.arc.io/arc/references/usdc-system-events) and
[EVM differences](https://docs.arc.io/arc/references/evm-differences):

- Arc implements **EIP-7708**. Every native USDC movement emits a standard ERC-20
  `Transfer(address indexed from, address indexed to, uint256 value)` log from the system address
  **`0xfffffffffffffffffffffffffffffffffffffffe`**, with the value in **18 decimals**. This covers plain
  sends, contract-creation endowments, SELFDESTRUCT and precompile operations.
- An ERC-20 `transfer()` on `0x3600…0000` emits **two** logs: the ERC-20 one (6 decimals) and the native
  system one (18 decimals). **Counting both double-counts.** ArcLens counts only the native system
  emitter stream, which covers every USDC movement exactly once.
- Zero-value transfers and self-transfers emit no log. Mints and burns use the zero address.
- Gas deductions do **not** emit logs. Gas cost has to be derived from receipts.
- The 6-decimal `balanceOf` truncates. Use `eth_getBalance` (18 decimals) for balances.

Verified live: `eth_getLogs` against emitter `0xffff…fffe` with topic0
`0xddf252ad…b3ef` returns these logs on mainnet. The public RPC also returns a non-standard
`blockTimestamp` field on each log, which saves a block lookup per log.

## 4. Data access options

### Officially listed
- **Node providers** ([docs](https://docs.arc.io/arc/tools/node-providers)): Arc public RPC, Alchemy,
  Blockdaemon, dRPC, QuickNode.
- **Data indexers** ([docs](https://docs.arc.io/arc/tools/data-indexers)): Alchemy (REST: balances,
  transfers, history), Envio (GraphQL), Goldsky (subgraphs / Mirror), Pinax (Firehose / Substreams),
  The Graph, thirdweb Insight.

### What was actually tested (2026-09-23)

| Source | Result |
| --- | --- |
| `rpc.mainnet.arc.io` `eth_getLogs` | Works. **Max 10,000-block range per call** (≈83 min of chain time). Rate limit around 2–4 req/s; bursts of 8 parallel requests returned `-32005 rate limit exceeded`. |
| `arc.drpc.org` (dRPC public) | Works, chain ID 5042. Free plan: "ranges over 10000 blocks are not supported". |
| `explorer.arc.io/api/v2/*` (Blockscout API) | Used by the explorer's own frontend, but server-side requests get a **Cloudflare challenge (403)**. Not usable from a backend, and ArcLens will not try to bypass bot protection. |
| `explorer.testnet.arc.io/api/v2/*` | Open JSON API, but **testnet only**. Not useful: Microgrants requires mainnet. |
| Alchemy `arc-mainnet.g.alchemy.com` | Host exists (returns key/whitelist errors without a key). Alchemy docs list Arc Mainnet under `alchemy_getAssetTransfers`. **Not tested end-to-end: no key available.** |

### Decision
ArcLens reads **directly from Arc mainnet over JSON-RPC** and reconstructs USDC activity from EIP-7708
system `Transfer` logs. This is the source of truth Arc's own docs describe for indexers.

- It works today with **no API keys**, using the official public RPC plus dRPC's public endpoint as a
  fallback.
- Because public RPCs cap `eth_getLogs` at 10k blocks and are rate-limited, a public-RPC deployment
  scans a **bounded recent window** of blocks. The UI always shows the exact block range analyzed, so
  there's no silent truncation.
- The provider sits behind a server-only interface (`src/lib/arc/provider.ts`). A keyed RPC with larger
  log ranges (Alchemy, QuickNode, a self-hosted node) is a config change (`ARC_RPC_URLS`,
  `ARC_LOG_BLOCK_RANGE`), not a rewrite. Swapping in an indexer such as Envio or Goldsky only requires
  implementing the same interface.

Point-in-time facts don't need log scans. These come from single RPC calls and cover **full history**:
- `eth_getBalance`: current USDC balance (18 decimals).
- `eth_getTransactionCount`: number of transactions the address has *sent* (its nonce).
- `eth_getCode`: whether the address is a contract.
- `eth_getTransactionByHash` / `eth_getTransactionReceipt`: transaction page.

## 5. Arc Microgrants (DoraHacks)

Source: [dorahacks.io/hackathon/arc-microgrants/detail](https://dorahacks.io/hackathon/arc-microgrants/detail), read 2026-09-23.

- **Pool:** 10,000 USDC, split into **20 × 500 USDC** microgrants, paid in USDC on Arc.
- **Funds:** "Tiny apps, proofs of concept, prototypes, demos, hackathon continuations, experimental
  infrastructure, and early technical experiments, all deployed and working on Arc mainnet."
- **Deadline:** submissions close **October 14, 2026, 23:59 ET**. Reviews are rolling, and all decisions
  are due by October 21.
- **Submission needs:**
  1. A live deployment on **Arc mainnet**, with a link reviewers can open.
  2. A public repo.
  3. A short description of what the project does and **what it uses Arc for**.
  4. A public builder profile (GitHub, X, or Farcaster).
- **Not eligible:** design mockups, slide decks, **testnet-only builds**, projects with no Arc component,
  and work already funded by Circle or Arc.
- **What they look for:** "Relevance to Arc, technical credibility, the quality of what you built, and
  whether the project is worth taking further. Promise counts for more than traction here."

### Open question: what does "deployed on Arc mainnet" mean for a read-only app?
The page says "Submit a project that is already deployed and working on Arc mainnet" and notes that
"Arc uses USDC to pay gas, so you will need a small amount of USDC on Arc to deploy and transact". That
second line implies but doesn't strictly require an on-chain contract. ArcLens is a read-only app that
works against Arc mainnet data. **Reviewers may or may not treat this as "deployed on Arc mainnet".**
One way to remove the ambiguity is a small on-chain component, for example a minimal contract that
anchors a hash of a published report. That is listed as a future option in
`docs/hackathon-positioning.md` and is *not* implemented. This is a product decision for the builder.

## 6. Brand notes (for the visual accent)
`arc.io` (checked 2026-09-23) uses a light layout with deep navy (`rgb(27,49,88)`), mid blue
(`rgb(47,87,140)`), pale blue (`rgb(172,198,233)`) and a warm amber highlight (`rgb(233,161,63)`), set in
Space Grotesk and DM Sans. ArcLens borrows the **pale Arc blue** as its restrained accent on a dark
observatory palette, and uses amber for warnings and highlights. It does not reuse Arc's logo or wordmark.
