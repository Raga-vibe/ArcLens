import type { Address, ErrorCode, Hex, WindowKey } from "@/lib/types";
import { isAddress, isTxHash, isWindowKey, MAX_INPUT_LENGTH, normalizeAddress } from "@/lib/validate";
import { isNetworkKey, type NetworkKey } from "@/lib/networks";

// Pure request validation for API routes (unit-tested).

export type Validated<T> = { ok: true; value: T } | { ok: false; code: ErrorCode };

export function validateWalletRequest(
  rawAddress: string | undefined,
  rawWindow: string | null,
  allowed: WindowKey[],
  rawNetwork: string | null = null,
  rawAsset: string | null = null,
): Validated<{ address: Address; window: WindowKey; network: NetworkKey; asset: string }> {
  if (!rawAddress || rawAddress.length > MAX_INPUT_LENGTH || !isAddress(rawAddress))
    return { ok: false, code: "INVALID_ADDRESS" };
  const network = rawNetwork ?? "arc-mainnet";
  if (!isNetworkKey(network)) return { ok: false, code: "INVALID_NETWORK" };
  const asset = rawAsset ?? "native";
  if (asset !== "native" && !isAddress(asset)) return { ok: false, code: "INVALID_ASSET" };
  if (network === "arc-mainnet" && asset !== "native") return { ok: false, code: "INVALID_ASSET" };
  const window = rawWindow ?? "24h";
  if (!isWindowKey(window) || !allowed.includes(window)) return { ok: false, code: "INVALID_WINDOW" };
  return { ok: true, value: { address: normalizeAddress(rawAddress), window, network, asset: asset === "native" ? "native" : normalizeAddress(asset) } };
}

export function validateTxRequest(rawHash: string | undefined): Validated<Hex> {
  if (!rawHash || rawHash.length > MAX_INPUT_LENGTH || !isTxHash(rawHash))
    return { ok: false, code: "INVALID_HASH" };
  return { ok: true, value: rawHash.toLowerCase() as Hex };
}
