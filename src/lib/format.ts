// Formatting helpers shared by server-generated text and the UI.

export function shortAddress(a: string, head = 6, tail = 4) {
  if (!a) return "";
  return a.length <= head + tail + 1 ? a : `${a.slice(0, head)}…${a.slice(-tail)}`;
}

export function formatUsd(v: number, opts: { compact?: boolean; precise?: boolean } = {}) {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (opts.compact && abs >= 10_000) {
    return `$${new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(v)}`;
  }
  if (!opts.precise && abs > 0 && abs < 0.01) return v < 0 ? "−<$0.01" : "<$0.01";
  const s = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: opts.precise ? 6 : 2,
  }).format(Math.abs(v));
  return `${v < 0 ? "−" : ""}$${s}`;
}

/** Full-precision USDC amount, e.g. "1,234.567891 USDC". */
export function formatUsdc(v: number) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(v)} USDC`;
}

export function formatInt(v: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(v));
}

export function formatPct(v: number, digits = 0) {
  return `${(v * 100).toFixed(digits)}%`;
}

export function formatSignedPct(v: number) {
  const p = Math.round(v * 100);
  return `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p)}%`;
}

const dtf = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  hour12: false,
});

export function formatDateTime(unix: number) {
  return `${dtf.format(new Date(unix * 1000))} UTC`;
}

const dShort = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
export function formatDay(unix: number) {
  return dShort.format(new Date(unix * 1000));
}

export function formatHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

export function formatRelative(unix: number, now: number) {
  const d = Math.max(0, now - unix);
  if (d < 60) return `${Math.round(d)}s ago`;
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86_400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86_400)}d ago`;
}

export function formatDuration(seconds: number) {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} minutes`;
  if (seconds < 2 * 86_400) return `${Math.round(seconds / 3600)} hours`;
  return `${Math.round(seconds / 86_400)} days`;
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
