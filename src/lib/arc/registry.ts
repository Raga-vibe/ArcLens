import "server-only";
import { decodeFunctionResult, encodeFunctionData, type Hex } from "viem";
import type { Address } from "@/lib/types";
import { REGISTRY_ADDRESS } from "./chain";
import { registryAbi } from "./registry-artifact";
import { rpc } from "./rpc";

export interface AnchorRecord {
  reportHash: Hex;
  subject: Address;
  anchoredBy: Address;
  fromBlock: number;
  toBlock: number;
  anchoredAt: number;
}

// Deployment status: once code exists it can't disappear, so a positive result
// is cached forever; a negative one is rechecked after a short delay.
let deployedCache: { deployed: boolean; at: number } | null = null;

export async function isRegistryDeployed(): Promise<boolean> {
  if (deployedCache?.deployed) return true;
  if (deployedCache && Date.now() - deployedCache.at < 20_000) return false;
  const code = await rpc<string>("eth_getCode", [REGISTRY_ADDRESS, "latest"]);
  const deployed = !!code && code !== "0x";
  deployedCache = { deployed, at: Date.now() };
  return deployed;
}

async function callRegistry<N extends "recentAnchorsFor" | "anchorCountFor" | "anchorOf">(
  functionName: N,
  args: readonly unknown[],
) {
  const data = encodeFunctionData({ abi: registryAbi, functionName, args } as never);
  const ret = await rpc<Hex>("eth_call", [{ to: REGISTRY_ADDRESS, data }, "latest"]);
  return decodeFunctionResult({ abi: registryAbi, functionName, data: ret } as never) as unknown;
}

type RawAnchor = { reportHash: Hex; subject: string; anchoredBy: string; fromBlock: bigint; toBlock: bigint; anchoredAt: bigint };

const toRecord = (a: RawAnchor): AnchorRecord => ({
  reportHash: a.reportHash,
  subject: a.subject.toLowerCase() as Address,
  anchoredBy: a.anchoredBy.toLowerCase() as Address,
  fromBlock: Number(a.fromBlock),
  toBlock: Number(a.toBlock),
  anchoredAt: Number(a.anchoredAt),
});

export async function getAnchorsFor(subject: Address, limit = 10) {
  const [count, list] = await Promise.all([
    callRegistry("anchorCountFor", [subject]) as Promise<bigint>,
    callRegistry("recentAnchorsFor", [subject, BigInt(limit)]) as Promise<RawAnchor[]>,
  ]);
  return { total: Number(count), anchors: list.map(toRecord) };
}

export async function getAnchorByHash(reportHash: Hex): Promise<AnchorRecord | null> {
  const [found, a] = (await callRegistry("anchorOf", [reportHash])) as [boolean, RawAnchor];
  return found ? toRecord(a) : null;
}
