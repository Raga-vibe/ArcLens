import "server-only";

// In-memory fixed-window limiter. Per-instance only: good enough to blunt
// abuse of the (expensive) analysis endpoint without adding infrastructure.
// Replace with a shared store (e.g. Upstash) if deployed at scale.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  return ip.slice(0, 64);
}

export function rateLimit(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  if (now - lastSweep > windowMs) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    lastSweep = now;
  }
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  return {
    ok: b.count <= limit,
    remaining: Math.max(0, limit - b.count),
    retryAfter: Math.ceil((b.resetAt - now) / 1000),
  };
}

/** Cap concurrent heavy analyses per instance to protect upstream RPCs. */
let inFlight = 0;
export const MAX_CONCURRENT_ANALYSES = 4;

export function tryAcquireSlot() {
  if (inFlight >= MAX_CONCURRENT_ANALYSES) return false;
  inFlight++;
  return true;
}

export function releaseSlot() {
  inFlight = Math.max(0, inFlight - 1);
}
