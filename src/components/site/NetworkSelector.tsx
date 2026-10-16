"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getNetwork, NETWORK_OPTIONS, type NetworkKey } from "@/lib/networks";

export function NetworkSelector({ currentNetwork = "arc-mainnet" }: { currentNetwork?: NetworkKey }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const net = getNetwork(currentNetwork);

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("pointerdown", onPointerDown);
      return () => document.removeEventListener("pointerdown", onPointerDown);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [open]);

  function selectNetwork(key: NetworkKey) {
    setOpen(false);
    if (key === currentNetwork) return;

    const params = new URLSearchParams(searchParams.toString());
    if (key === "arc-mainnet") {
      params.delete("network");
    } else {
      params.set("network", key);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Select network, currently ${net.name}`}
        onClick={() => setOpen((prev) => !prev)}
        className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-2.5 py-1 text-[11px] text-ink-2 shadow-sm backdrop-blur-md transition-all duration-200 hover:border-accent/40 hover:bg-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="relative flex size-2">
          <span
            className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:hidden ${
              currentNetwork === "arc-mainnet" ? "bg-good" : "bg-accent"
            }`}
          />
          <span
            className={`relative inline-flex size-2 rounded-full ${
              currentNetwork === "arc-mainnet" ? "bg-good" : "bg-accent"
            }`}
          />
        </span>
        <span className="font-medium tracking-tight">{net.name}</span>
        <svg
          viewBox="0 0 10 6"
          className={`size-2 text-muted transition-transform duration-200 group-hover:text-ink ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          aria-hidden="true"
        >
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Supported networks"
          className="absolute right-0 z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-xl border border-line-strong bg-elevated/95 p-1.5 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-mono tracking-wider uppercase text-muted">
            Select Chain
          </div>
          <div className="space-y-1">
            {NETWORK_OPTIONS.map((option) => {
              const active = option.key === currentNetwork;
              const isArc = option.key === "arc-mainnet";
              return (
                <button
                  key={option.key}
                  role="option"
                  aria-selected={active}
                  onClick={() => selectNetwork(option.key)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                    active
                      ? "bg-accent-wash text-ink"
                      : "text-ink-2 hover:bg-elevated-2 hover:text-ink"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`size-2 shrink-0 rounded-full ${
                        isArc ? "bg-good" : "bg-accent"
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 truncate">
                      <p className="font-medium truncate">{option.name}</p>
                      <p className="font-mono text-[10px] text-muted">
                        Chain {option.chainId} · {option.nativeCurrency.symbol}
                      </p>
                    </div>
                  </div>
                  {active && (
                    <span className="shrink-0 text-accent font-mono text-sm" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
