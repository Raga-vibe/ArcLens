"use client";

import { useEffect, useState } from "react";
import { formatInt } from "@/lib/format";

/** Real chain head from /api/status, refreshed every few seconds. */
export function LiveBlock() {
  const [block, setBlock] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      try {
        const r = await fetch("/api/status", { cache: "no-store" });
        const j = await r.json();
        if (alive && j.ok) {
          setBlock(j.data.block);
          setFailed(false);
        }
      } catch {
        if (alive) setFailed(true);
      }
      if (alive && document.visibilityState === "visible") timer = setTimeout(tick, 4000);
    }
    tick();
    const onVis = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (failed && block === null) return null;
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] text-muted" aria-live="off">
      <span className="text-faint">LATEST BLOCK</span>
      <span className="tabular text-ink-2">{block === null ? "—" : `#${formatInt(block)}`}</span>
    </span>
  );
}
