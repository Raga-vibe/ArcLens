import type { Address, Hex, WindowKey } from "@/lib/types";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const HEXISH_RE = /^(0x)?[0-9a-fA-F]+$/;

/** Hard cap on anything we'll even look at. Prevents oversized input abuse. */
export const MAX_INPUT_LENGTH = 100;

export type InputKind =
  | { kind: "address"; value: Address }
  | { kind: "tx"; value: Hex }
  | { kind: "empty" }
  | { kind: "invalid"; reason: string };

export function isAddress(v: unknown): v is Address {
  return typeof v === "string" && ADDRESS_RE.test(v);
}

export function isTxHash(v: unknown): v is Hex {
  return typeof v === "string" && HASH_RE.test(v);
}

export function normalizeAddress(v: string): Address {
  return v.toLowerCase() as Address;
}

/**
 * Classify free-form user input as an address, a transaction hash, or an
 * invalid value with a human-readable reason. Runs before any network call.
 */
export function classifyInput(raw: string): InputKind {
  const v = raw.trim();
  if (!v) return { kind: "empty" };
  if (v.length > MAX_INPUT_LENGTH)
    return { kind: "invalid", reason: "That input is too long to be an Arc address or transaction hash." };
  if (isAddress(v)) return { kind: "address", value: normalizeAddress(v) };
  if (isTxHash(v)) return { kind: "tx", value: v.toLowerCase() as Hex };
  if (/\.(eth|arc)$/i.test(v))
    return { kind: "invalid", reason: "Name lookups aren't supported yet. Paste a 0x… address instead." };
  if (HEXISH_RE.test(v)) {
    const body = v.startsWith("0x") ? v.slice(2) : v;
    if (!v.startsWith("0x") && (body.length === 40 || body.length === 64))
      return { kind: "invalid", reason: "Add the 0x prefix to analyze this value." };
    if (body.length < 40)
      return { kind: "invalid", reason: `That looks too short: an Arc address has 40 hex characters after 0x (you entered ${body.length}).` };
    if (body.length < 64)
      return { kind: "invalid", reason: "That's between an address and a transaction hash in length. Check that it was copied in full." };
    return { kind: "invalid", reason: "That value is too long for an address or transaction hash." };
  }
  return { kind: "invalid", reason: "Please enter a valid Arc wallet address (0x…) or transaction hash." };
}

export const WINDOW_KEYS: WindowKey[] = ["24h", "3d", "7d", "30d", "all"];

export function isWindowKey(v: unknown): v is WindowKey {
  return typeof v === "string" && (WINDOW_KEYS as string[]).includes(v);
}
