import type { Address, AddressLabel } from "@/lib/types";

// Public, verified constants. Sources are listed in docs/arc-research.md.

export const ARC_MAINNET = {
  name: "Arc",
  chainId: 5042,
  explorer: "https://explorer.arc.io",
  /** Launch date of public mainnet, per docs.arc.io "What's new". */
  publicLaunch: "2026-09-16",
} as const;

/** EIP-7708 system emitter for native USDC Transfer logs (18 decimals). */
export const NATIVE_TRANSFER_EMITTER =
  "0xfffffffffffffffffffffffffffffffffffffffe" as Address;

/** keccak256("Transfer(address,address,uint256)") */
export const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as Address;

export const NATIVE_DECIMALS = 18;

interface KnownToken {
  symbol: string;
  decimals: number;
  label: AddressLabel;
}

const DOCS_CONTRACTS = "docs.arc.io · Contract addresses";

/** Token contracts from the official Arc contract-address reference. */
export const KNOWN_TOKENS: Record<string, KnownToken> = {
  "0x3600000000000000000000000000000000000000": {
    symbol: "USDC",
    decimals: 6,
    label: { name: "USDC (ERC-20 interface)", source: DOCS_CONTRACTS },
  },
  "0xbef5f6d51cb62b58e6a8f77868681825c6fe21c1": {
    symbol: "EURC",
    decimals: 6,
    label: { name: "EURC", source: DOCS_CONTRACTS },
  },
  "0x8a5d989bbb96929f689b0200f435f53da42bf490": {
    symbol: "USYC",
    decimals: 6,
    label: { name: "USYC", source: DOCS_CONTRACTS },
  },
  "0x171a4217b86a807a64eb94757db6849fb4bdbaa0": {
    symbol: "cirBTC",
    decimals: 8,
    label: { name: "cirBTC", source: DOCS_CONTRACTS },
  },
  "0x128cc466b61f542da60c70e3aa11c10e19b84edb": {
    symbol: "WETH",
    decimals: 18,
    label: { name: "WETH", source: DOCS_CONTRACTS },
  },
};

const KNOWN_LABELS: Record<string, AddressLabel> = {
  [ZERO_ADDRESS]: { name: "Zero address (mint / burn)", source: "EIP-7708" },
  [NATIVE_TRANSFER_EMITTER]: {
    name: "Arc native transfer system address",
    source: "docs.arc.io · USDC system events",
  },
  "0xb69ecb156dc0028198028c501340d5367845ca72": {
    name: "USYC Entitlements",
    source: DOCS_CONTRACTS,
  },
  "0x51a8ce47dc08ba5cd19c7aa84ea6fd6664f60f9b": {
    name: "USYC Teller",
    source: DOCS_CONTRACTS,
  },
  ...Object.fromEntries(
    Object.entries(KNOWN_TOKENS).map(([a, t]) => [a, t.label]),
  ),
};

export function labelFor(address: string): AddressLabel | undefined {
  return KNOWN_LABELS[address.toLowerCase()];
}

export function explorerAddressUrl(address: string) {
  return `${ARC_MAINNET.explorer}/address/${address}`;
}

export function explorerTxUrl(hash: string) {
  return `${ARC_MAINNET.explorer}/tx/${hash}`;
}

export function explorerBlockUrl(block: number) {
  return `${ARC_MAINNET.explorer}/block/${block}`;
}
