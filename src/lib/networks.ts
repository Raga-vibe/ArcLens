import type { Address } from "@/lib/types";

export const NETWORKS = {
  "arc-mainnet": {
    key: "arc-mainnet",
    name: "Arc Mainnet",
    chainId: 5042,
    explorer: "https://explorer.arc.io",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
    finality: "deterministic",
  },
  "robinhood-testnet": {
    key: "robinhood-testnet",
    name: "Robinhood Chain Testnet",
    chainId: 46630,
    explorer: "https://explorer.testnet.chain.robinhood.com",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    finality: "sequenced",
  },
} as const;

export type NetworkKey = keyof typeof NETWORKS;
export type NetworkInfo = (typeof NETWORKS)[NetworkKey];

export const NETWORK_OPTIONS = Object.values(NETWORKS);

export function isNetworkKey(value: unknown): value is NetworkKey {
  return typeof value === "string" && value in NETWORKS;
}

export function getNetwork(key: NetworkKey): NetworkInfo {
  return NETWORKS[key];
}

export function explorerAddressUrl(address: string, network: NetworkKey = "arc-mainnet") {
  return `${NETWORKS[network].explorer}/address/${address}`;
}

export function explorerTxUrl(hash: string, network: NetworkKey = "arc-mainnet") {
  return `${NETWORKS[network].explorer}/tx/${hash}`;
}

export function explorerBlockUrl(block: number, network: NetworkKey = "arc-mainnet") {
  return `${NETWORKS[network].explorer}/block/${block}`;
}

export interface WalletAsset {
  /** `native` for the chain currency; otherwise the lower-case ERC-20 address. */
  key: string;
  symbol: string;
  decimals: number;
  address: Address | null;
  kind: "native" | "erc20";
}
