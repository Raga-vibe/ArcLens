/** ArcLens mark: a lens ring crossed by an arc, with an observed node. */
export function LogoMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="16" cy="16" r="12.5" stroke="currentColor" strokeWidth="2.2" opacity="0.9" />
      <path
        d="M5.5 21.5C9 13 23 13 26.5 21.5"
        stroke="var(--accent)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="15" r="3" fill="var(--accent)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-[0.18em] text-ink">
        ARC<span className="text-accent">LENS</span>
      </span>
    </span>
  );
}
