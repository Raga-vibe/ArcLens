import { NATIVE_TRANSFER_EMITTER, TRANSFER_TOPIC } from "@/lib/arc/chain";
import { addressToTopic, type RawLog } from "@/lib/analytics/normalize";
import type { Transaction } from "@/lib/types";

// Deterministic fixtures. Addresses are synthetic test values, not real wallets.
export const W = "0x1111111111111111111111111111111111111111";
export const A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
export const C = "0xcccccccccccccccccccccccccccccccccccccccc";

/** 2026-09-21T00:00:00Z (a Monday) */
export const T0 = 1789948800;

const usdc = (v: number) => `0x${(BigInt(Math.round(v * 1e6)) * BigInt(1e12)).toString(16)}`;

export function log(
  from: string,
  to: string,
  value: number,
  block: number,
  ts: number,
  logIndex = 0,
  overrides: Partial<RawLog> = {},
): RawLog {
  return {
    address: NATIVE_TRANSFER_EMITTER,
    topics: [TRANSFER_TOPIC, addressToTopic(from), addressToTopic(to)],
    data: usdc(value),
    blockNumber: `0x${block.toString(16)}`,
    blockTimestamp: `0x${ts.toString(16)}`,
    transactionHash: `0x${block.toString(16).padStart(64, "0")}`,
    logIndex: `0x${logIndex.toString(16)}`,
    ...overrides,
  };
}

let seq = 0;
export function tx(direction: "in" | "out", counterparty: string, value: number, timestamp: number, block?: number): Transaction {
  seq++;
  const b = block ?? 1000 + seq;
  const hash = `0x${b.toString(16).padStart(64, "0")}` as const;
  return {
    id: `${hash}:0`,
    txHash: hash,
    logIndex: 0,
    blockNumber: b,
    timestamp,
    from: (direction === "in" ? counterparty : W) as `0x${string}`,
    to: (direction === "in" ? W : counterparty) as `0x${string}`,
    valueRaw: (BigInt(Math.round(value * 1e6)) * BigInt(1e12)).toString(),
    value,
    token: "USDC",
    direction,
    counterparty: counterparty as `0x${string}`,
  };
}

/** A small, hand-checkable wallet history. */
export function sampleWallet(): Transaction[] {
  return [
    tx("in", A, 100, T0 + 3600 * 1), // Mon 01:00
    tx("in", A, 50, T0 + 3600 * 2), // Mon 02:00
    tx("out", B, 30, T0 + 3600 * 2 + 60), // Mon 02:01
    tx("out", C, 10, T0 + 86400 + 3600 * 20), // Tue 20:00
    tx("in", B, 200, T0 + 86400 + 3600 * 21), // Tue 21:00
    tx("out", A, 5, T0 + 86400 * 2 + 3600 * 21), // Wed 21:00
  ];
}
