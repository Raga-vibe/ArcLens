import "server-only";
import type { ErrorCode, ErrorResponse } from "@/lib/types";

const MESSAGES: Record<ErrorCode, string> = {
  INVALID_ADDRESS: "Please enter a valid Arc wallet address.",
  INVALID_HASH: "Please enter a valid Arc transaction hash.",
  INVALID_WINDOW: "That time window isn't available on this deployment.",
  NOT_FOUND: "Nothing was found on Arc mainnet for that input.",
  RATE_LIMITED: "Too many analyses in a short time. Please wait a moment and try again.",
  UPSTREAM_UNAVAILABLE: "Arc data is temporarily unavailable. Please try again shortly.",
  INTERNAL: "Something went wrong while analyzing. Please try again.",
};

const STATUS: Record<ErrorCode, number> = {
  INVALID_ADDRESS: 400,
  INVALID_HASH: 400,
  INVALID_WINDOW: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  UPSTREAM_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export function errorBody(code: ErrorCode, retryAfter?: number): ErrorResponse {
  return { ok: false, error: { code, message: MESSAGES[code], ...(retryAfter ? { retryAfter } : {}) } };
}

/** User-safe JSON error. Never forwards upstream error text. */
export function errorResponse(code: ErrorCode, retryAfter?: number) {
  return Response.json(errorBody(code, retryAfter), {
    status: STATUS[code],
    headers: retryAfter ? { "retry-after": String(retryAfter) } : undefined,
  });
}

/** Map any thrown error to a safe code, logging the detail server-side only. */
export function toErrorCode(err: unknown): ErrorCode {
  const e = err as { kind?: string; name?: string };
  console.error("[arclens]", err);
  if (e?.kind === "rate-limit" || e?.kind === "upstream" || e?.kind === "range") return "UPSTREAM_UNAVAILABLE";
  if (e?.kind === "not-found") return "NOT_FOUND";
  return "INTERNAL";
}
