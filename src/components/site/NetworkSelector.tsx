"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getNetwork, NETWORK_OPTIONS, type NetworkKey } from "@/lib/networks";

export function NetworkSelector({ currentNetwork = "arc-mainnet" }: { currentNetwork?: NetworkKey }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const net = getNetwork(currentNetwork);
  const selectedIndex = NETWORK_OPTIONS.findIndex((option) => option.key === currentNetwork);

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
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    if (open) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, selectedIndex]);

  function selectNetwork(key: NetworkKey) {
    setOpen(false);
    if (key === currentNetwork) return;

    const params = new URLSearchParams(searchParams.toString());
    // Network-specific asset metadata and window limits do not carry across chains.
    params.delete("asset");
    params.delete("window");
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
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-controls="network-menu"
        aria-expanded={open}
        aria-label={`Select network. Current network: ${net.name}, ${net.environment}, chain ID ${net.chainId}`}
        onClick={() => setOpen((prev) => !prev)}
        className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-2.5 py-1 text-[11px] text-ink-2 shadow-sm backdrop-blur-md transition-all duration-200 hover:border-accent/40 hover:bg-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
        <span className="font-medium tracking-tight">{net.name}</span>
        <span className="hidden font-mono text-[9px] uppercase tracking-wide text-muted sm:inline">{net.environment}</span>
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
          id="network-menu"
          role="menu"
          aria-label="Select a network"
          className="absolute right-0 z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-xl border border-line-strong bg-elevated/95 p-1.5 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-2.5 pb-2 pt-1.5">
            <p className="text-xs font-medium text-ink">Supported networks</p>
            <p className="mt-0.5 text-[11px] text-muted">Choose where to read activity.</p>
          </div>
          <div className="space-y-1">
            {NETWORK_OPTIONS.map((option, index) => {
              const active = option.key === currentNetwork;
              return (
                <button
                  key={option.key}
                  ref={(element) => { optionRefs.current[index] = element; }}
                  role="menuitemradio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();
                      const direction = event.key === "ArrowDown" ? 1 : -1;
                      optionRefs.current[(index + direction + NETWORK_OPTIONS.length) % NETWORK_OPTIONS.length]?.focus();
                    } else if (event.key === "Home" || event.key === "End") {
                      event.preventDefault();
                      optionRefs.current[event.key === "Home" ? 0 : NETWORK_OPTIONS.length - 1]?.focus();
                    }
                  }}
                  onClick={() => selectNetwork(option.key)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                    active
                      ? "bg-accent-wash text-ink"
                      : "text-ink-2 hover:bg-elevated-2 hover:text-ink"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{option.name}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted">
                        Chain {option.chainId} · {option.nativeCurrency.symbol} native
                      </p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wide ${active ? "border-accent/30 text-accent" : "border-line text-muted"}`}>
                    {option.environment}
                  </span>
                  {active && (
                    <span className="sr-only">Selected</span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 border-t border-line px-2.5 pt-2 text-[10px] leading-relaxed text-muted">
            Testnet activity is for testing. Token amounts are not treated as USD values.
          </p>
        </div>
      )}
    </div>
  );
}
