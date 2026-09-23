import type { Address, ErrorCode, Hex, WindowKey } from "@/lib/types";
import { isAddress, isTxHash, isWindowKey, MAX_INPUT_LENGTH, normalizeAddress } from "@/lib/validate";

// Pure request validation for API routes (unit-tested).

export type Validated<T> = { ok: true; value: T } | { ok: false; code: ErrorCode };

export function validateWalletRequest(
  rawAddress: string | undefined,
  rawWindow: string | null,
  allowed: WindowKey[],
): Validated<{ address: Address; window: WindowKey }> {
  if (!rawAddress || rawAddress.length > MAX_INPUT_LENGTH || !isAddress(rawAddress))
    return { ok: false, code: "INVALID_ADDRESS" };
  const window = rawWindow ?? "24h";
  if (!isWindowKey(window) || !allowed.includes(window)) return { ok: false, code: "INVALID_WINDOW" };
  return { ok: true, value: { address: normalizeAddress(rawAddress), window } };
}

export function validateTxRequest(rawHash: string | undefined): Validated<Hex> {
  if (!rawHash || rawHash.length > MAX_INPUT_LENGTH || !isTxHash(rawHash))
    return { ok: false, code: "INVALID_HASH" };
  return { ok: true, value: rawHash.toLowerCase() as Hex };
}
