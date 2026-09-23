// Public site configuration (safe for the client bundle).

export const SITE = {
  name: "ArcLens",
  tagline: "See what’s happening on Arc.",
  description:
    "Explore Arc wallet activity through visual analytics, transaction flows, counterparties, and on-chain statistics.",
  // NEXT_PUBLIC_SITE_URL wins; on Vercel fall back to the production domain.
  url: (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
  ).replace(/\/$/, ""),
  github: process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com/Raga-vibe/ArcLens",
  x: process.env.NEXT_PUBLIC_X_URL || "https://x.com/",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
};

/**
 * Example wallet for "Try an example". This is a real, highly active Arc
 * mainnet contract (verified on-chain: has bytecode, appears in EIP-7708
 * Transfer logs). It is a contract, not a personal wallet, and ArcLens makes
 * no claim about who operates it.
 */
export const EXAMPLE_ADDRESS = "0x43d894e229a008c72e96872739719b9cfda941d5";
