"use client";

import {
  type Address,
  type Chain,
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  type EIP1193Provider,
  type Hex,
} from "viem";
import { ARC_MAINNET } from "@/lib/arc/chain";

// Browser-wallet helpers. Everything goes through the user's injected wallet
// (EIP-1193): ArcLens never sees keys, and the browser never calls RPCs directly
// (CSP connect-src 'self'), so reads during a wallet flow also go via the wallet.

export const arcChain: Chain = defineChain({
  id: ARC_MAINNET.chainId,
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.arc.io"] } },
  blockExplorers: { default: { name: "Arc Explorer", url: ARC_MAINNET.explorer } },
});

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export class WalletError extends Error {
  constructor(
    message: string,
    public kind: "no-wallet" | "rejected" | "wrong-chain" | "insufficient-funds" | "reverted" | "unknown",
  ) {
    super(message);
  }
}

export function hasWallet() {
  return typeof window !== "undefined" && !!window.ethereum;
}

function provider(): EIP1193Provider {
  if (!hasWallet()) throw new WalletError("No browser wallet found. Install MetaMask or Rabby, then reload.", "no-wallet");
  return window.ethereum!;
}

/** Map wallet/RPC errors to plain language. */
export function explainWalletError(e: unknown): WalletError {
  if (e instanceof WalletError) return e;
  const err = e as { code?: number; message?: string; shortMessage?: string; cause?: { code?: number } };
  const code = err.code ?? err.cause?.code;
  const msg = `${err.shortMessage ?? ""} ${err.message ?? ""}`.toLowerCase();
  if (code === 4001 || msg.includes("user rejected") || msg.includes("denied"))
    return new WalletError("You cancelled the request in your wallet.", "rejected");
  if (msg.includes("insufficient funds") || msg.includes("exceeds balance"))
    return new WalletError("Not enough USDC on Arc to pay the network fee.", "insufficient-funds");
  if (msg.includes("alreadyanchored")) return new WalletError("This exact report is already anchored on Arc.", "reverted");
  if (msg.includes("revert")) return new WalletError("The transaction was rejected by the contract.", "reverted");
  return new WalletError("Something went wrong with the wallet request. Please try again.", "unknown");
}

/** Connect, and make sure the wallet is on Arc mainnet (adding it if needed). */
export async function connectArc(): Promise<Address> {
  const p = provider();
  const accounts = (await p.request({ method: "eth_requestAccounts" })) as Address[];
  if (!accounts?.length) throw new WalletError("No account selected in your wallet.", "rejected");
  const chainIdHex = `0x${ARC_MAINNET.chainId.toString(16)}` as Hex;
  const current = (await p.request({ method: "eth_chainId" })) as Hex;
  if (current.toLowerCase() !== chainIdHex) {
    try {
      await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
    } catch (e) {
      const code = (e as { code?: number }).code;
      if (code !== 4902 && code !== -32603) throw e;
      await p.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: "Arc",
            nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
            rpcUrls: ["https://rpc.mainnet.arc.io"],
            blockExplorerUrls: [ARC_MAINNET.explorer],
          },
        ],
      });
    }
  }
  return accounts[0];
}

export function walletClient(account: Address) {
  return createWalletClient({ account, chain: arcChain, transport: custom(provider()) });
}

export function readClient() {
  return createPublicClient({ chain: arcChain, transport: custom(provider()) });
}
