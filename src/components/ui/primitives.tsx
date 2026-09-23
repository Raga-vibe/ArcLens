"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { explorerAddressUrl } from "@/lib/arc/chain";
import { shortAddress } from "@/lib/format";
import type { AddressKind, AddressLabel, Direction } from "@/lib/types";

export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className={`inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-ink ${className ?? ""}`}
      aria-label={copied ? "Copied" : label}
    >
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
        {copied ? (
          <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <>
            <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M3 10.5V4.5A1.5 1.5 0 0 1 4.5 3h6" stroke="currentColor" strokeWidth="1.4" />
          </>
        )}
      </svg>
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}

export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-muted transition-colors hover:text-accent ${className ?? ""}`}
    >
      {children}
      <svg viewBox="0 0 12 12" className="size-3" fill="none" aria-hidden="true">
        <path d="M4 2h6v6M10 2 3 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function DirectionBadge({ d, compact }: { d: Direction | "both"; compact?: boolean }) {
  const map = {
    in: { label: "In", icon: "↓", cls: "text-in border-in/30 bg-in/10" },
    out: { label: "Out", icon: "↑", cls: "text-out border-out/30 bg-out/10" },
    both: { label: "Both", icon: "↕", cls: "text-ink-2 border-line-strong bg-elevated" },
  }[d];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${map.cls}`}>
      <span aria-hidden="true">{map.icon}</span>
      {compact ? <span className="sr-only">{map.label}</span> : map.label}
    </span>
  );
}

export function KindTag({ kind, label }: { kind: AddressKind; label?: AddressLabel }) {
  if (label)
    return (
      <span title={`Source: ${label.source}`} className="rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">
        {label.name}
      </span>
    );
  if (kind === "unknown") return null;
  return (
    <span className="rounded border border-line px-1.5 py-0.5 text-[10px] text-muted" title={kind === "contract" ? "Has deployed bytecode" : "No deployed bytecode (externally owned account)"}>
      {kind === "contract" ? "Contract" : "Account"}
    </span>
  );
}

/** Address rendered as a link to its ArcLens report. */
export function AddressLink({ address, full, className }: { address: string; full?: boolean; className?: string }) {
  return (
    <Link
      href={`/wallet/${address}`}
      className={`font-mono text-[13px] text-ink-2 underline decoration-transparent underline-offset-4 transition-colors hover:text-accent hover:decoration-accent/50 ${className ?? ""}`}
      title={address}
    >
      {full ? address : shortAddress(address)}
    </Link>
  );
}

export function explorerAddress(address: string) {
  return explorerAddressUrl(address);
}

/** Animated number that counts up once when scrolled into view. */
export function CountUp({ value, format }: { value: number; format: (v: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [animated, setShown] = useState(0);
  const shown = reduce ? value : animated;

  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, value, { duration: 1.1, ease: [0.22, 1, 0.36, 1], onUpdate: setShown });
    return () => c.stop();
  }, [inView, value, reduce]);

  return (
    <span ref={ref} className="tabular">
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}

export function EmptyState({
  title,
  body,
  icon = "◌",
  action,
}: {
  title: string;
  body?: ReactNode;
  icon?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span aria-hidden="true" className="grid size-10 place-items-center rounded-full border border-line text-lg text-muted">
        {icon}
      </span>
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {body && <div className="max-w-sm text-sm text-muted">{body}</div>}
      {action}
    </div>
  );
}

export function Panel({
  title,
  eyebrow,
  actions,
  children,
  className,
  id,
  description,
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  description?: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={`panel ${className ?? ""}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div>
          {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
          <h2 id={id ? `${id}-title` : undefined} className="text-[15px] font-medium text-ink">
            {title}
          </h2>
          {description && <p className="mt-1 text-xs text-muted">{description}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-bg p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
            value === o.value ? "bg-elevated-2 text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
