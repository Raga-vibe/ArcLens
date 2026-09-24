"use client";

import { useEffect, useState } from "react";
import { Reveal } from "@/components/motion/Reveal";

const FACTS = [
  [
    "Proof written back to Arc",
    "Any report's fingerprint can be anchored on Arc mainnet through the ArcLensRegistry contract, so anyone can verify it later.",
  ],
  [
    "Fees in cents, paid in USDC",
    "Anchoring a report costs well under a cent, paid in USDC from the user's own wallet. No separate gas token needed.",
  ],
];

/** Only claims on-chain anchoring once the registry actually exists on Arc. */
export function ProofFacts() {
  const [live, setLive] = useState(false);
  useEffect(() => {
    fetch("/api/registry")
      .then((r) => r.json())
      .then((j) => setLive(!!j.ok && j.data.deployed))
      .catch(() => {});
  }, []);
  if (!live) return null;
  return (
    <>
      {FACTS.map(([t, b], i) => (
        <Reveal key={t} delay={0.24 + i * 0.06} className="bg-surface p-6">
          <dt className="text-base font-medium text-ink">{t}</dt>
          <dd className="mt-2 text-sm leading-relaxed text-muted">{b}</dd>
        </Reveal>
      ))}
    </>
  );
}
