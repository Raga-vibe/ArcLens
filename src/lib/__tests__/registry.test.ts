import { Common, Hardfork, Mainnet } from "@ethereumjs/common";
import { createEVM } from "@ethereumjs/evm";
import { Account, Address, hexToBytes } from "@ethereumjs/util";
import { decodeErrorResult, decodeFunctionResult, encodeFunctionData, type Hex, keccak256, toHex } from "viem";
import { beforeAll, describe, expect, it } from "vitest";
import { create2Factory, registryAbi, registryBytecode, registryPredictedAddress, registrySalt } from "@/lib/arc/registry-artifact";

// Runs the compiled ArcLensRegistry bytecode on a real in-process EVM.

const alice = new Address(hexToBytes("0x00000000000000000000000000000000000a11ce"));
const bob = new Address(hexToBytes("0x0000000000000000000000000000000000000b0b"));
const SUBJECT = "0x43d894e229a008c72e96872739719b9cfda941d5";
const H1 = keccak256(toHex("report-1"));
const H2 = keccak256(toHex("report-2"));

type Evm = Awaited<ReturnType<typeof createEVM>>;
let evm: Evm;
let registry: Address;

const block = (n: bigint) =>
  ({
    header: {
      number: n,
      coinbase: new Address(new Uint8Array(20)),
      timestamp: 1_790_000_000n,
      difficulty: 0n,
      prevRandao: new Uint8Array(32),
      gasLimit: 30_000_000n,
      baseFeePerGas: 0n,
      getBlobGasPrice: () => 1n,
    },
  }) as never;

async function call(from: Address, data: Hex, at = 100n) {
  const r = await evm.runCall({ caller: from, to: registry, data: hexToBytes(data), gasLimit: 1_000_000n, block: block(at) });
  return { ret: toHex(r.execResult.returnValue), error: r.execResult.exceptionError, logs: r.execResult.logs ?? [] };
}

async function read<N extends "totalAnchors" | "anchorOf" | "anchorCountFor" | "recentAnchorsFor" | "anchorAt">(
  functionName: N,
  args: readonly unknown[] = [],
) {
  const data = encodeFunctionData({ abi: registryAbi, functionName, args } as never);
  const r = await call(alice, data);
  return decodeFunctionResult({ abi: registryAbi, functionName, data: r.ret } as never) as unknown;
}

const anchor = (from: Address, reportHash: Hex, fromBlock = 10n, toBlock = 20n, at = 100n) =>
  call(from, encodeFunctionData({ abi: registryAbi, functionName: "anchor", args: [SUBJECT, fromBlock, toBlock, reportHash] }), at);

beforeAll(async () => {
  evm = await createEVM({ common: new Common({ chain: Mainnet, hardfork: Hardfork.Cancun }) });
  await evm.stateManager.putAccount(alice, new Account(0n, 10n ** 18n));
  await evm.stateManager.putAccount(bob, new Account(0n, 10n ** 18n));
  const r = await evm.runCall({ caller: alice, data: hexToBytes(registryBytecode), gasLimit: 3_000_000n, block: block(1n) });
  expect(r.execResult.exceptionError).toBeUndefined();
  registry = r.createdAddress!;
});

describe("deterministic deployment", () => {
  it("lands at the predicted address when deployed through the CREATE2 factory", async () => {
    // Canonical factory runtime, byte-identical to the code on Arc mainnet.
    const factory = new Address(hexToBytes(create2Factory));
    await evm.stateManager.putCode(
      factory,
      hexToBytes("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3"),
    );
    const r = await evm.runCall({
      caller: bob,
      to: factory,
      data: hexToBytes(`${registrySalt}${registryBytecode.slice(2)}`),
      gasLimit: 3_000_000n,
      block: block(2n),
    });
    expect(r.execResult.exceptionError).toBeUndefined();
    expect(toHex(r.execResult.returnValue)).toBe(registryPredictedAddress);
    const code = await evm.stateManager.getCode(new Address(hexToBytes(registryPredictedAddress)));
    expect(code.length).toBeGreaterThan(0);
  });
});

describe("ArcLensRegistry (compiled bytecode)", () => {
  it("starts empty", async () => {
    expect(await read("totalAnchors")).toBe(0n);
    const [found] = (await read("anchorOf", [H1])) as [boolean, unknown];
    expect(found).toBe(false);
  });

  it("anchors a report and emits ReportAnchored", async () => {
    const r = await anchor(alice, H1);
    expect(r.error).toBeUndefined();
    expect(r.logs).toHaveLength(1);
    expect(await read("totalAnchors")).toBe(1n);
    const [found, a] = (await read("anchorOf", [H1])) as [boolean, Record<string, unknown>];
    expect(found).toBe(true);
    expect(a.reportHash).toBe(H1);
    expect(String(a.subject).toLowerCase()).toBe(SUBJECT);
    expect(String(a.anchoredBy).toLowerCase()).toBe(alice.toString());
    expect(a.fromBlock).toBe(10n);
    expect(a.toBlock).toBe(20n);
    expect(a.anchoredAt).toBe(100n);
  });

  it("rejects duplicates, zero hashes and bad ranges", async () => {
    const dup = await anchor(bob, H1);
    expect(dup.error).toBeDefined();
    expect(decodeErrorResult({ abi: registryAbi, data: dup.ret }).errorName).toBe("AlreadyAnchored");

    const zero = await anchor(bob, `0x${"00".repeat(32)}`);
    expect(decodeErrorResult({ abi: registryAbi, data: zero.ret }).errorName).toBe("ZeroHash");

    const inverted = await anchor(bob, H2, 30n, 20n);
    expect(decodeErrorResult({ abi: registryAbi, data: inverted.ret }).errorName).toBe("InvalidRange");

    const future = await anchor(bob, H2, 10n, 500n, 100n);
    expect(decodeErrorResult({ abi: registryAbi, data: future.ret }).errorName).toBe("InvalidRange");
  });

  it("lists recent anchors per subject, newest first", async () => {
    expect((await anchor(bob, H2, 20n, 30n, 120n)).error).toBeUndefined();
    expect(await read("anchorCountFor", [SUBJECT])).toBe(2n);
    const list = (await read("recentAnchorsFor", [SUBJECT, 10n])) as Record<string, unknown>[];
    expect(list.map((a) => a.reportHash)).toEqual([H2, H1]);
    const one = (await read("recentAnchorsFor", [SUBJECT, 1n])) as Record<string, unknown>[];
    expect(one).toHaveLength(1);
    expect(await read("anchorCountFor", ["0x0000000000000000000000000000000000000001"])).toBe(0n);
  });
});
