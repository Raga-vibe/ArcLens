"use client";

// Privacy-friendly product analytics. Disabled unless
// NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set (Plausible is cookieless, so no consent
// banner is required). Never pass wallet addresses or hashes as properties.

export type ProductEvent =
  | "landing_view"
  | "wallet_analysis_started"
  | "wallet_analysis_completed"
  | "transaction_analysis_started"
  | "transaction_analysis_completed"
  | "share_report";

type Props = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: Props }) => void;
  }
}

export function track(event: ProductEvent, props?: Props) {
  if (typeof window === "undefined") return;
  try {
    window.plausible?.(event, props ? { props } : undefined);
  } catch {
    /* analytics must never break the app */
  }
}
