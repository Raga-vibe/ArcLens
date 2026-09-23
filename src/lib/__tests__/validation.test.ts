import { describe, expect, it } from "vitest";
import { decodeMovements } from "@/lib/analytics/transaction";
import { validateTxRequest, validateWalletRequest } from "@/lib/request";
import { classifyInput } from "@/lib/validate";
import { A, log, T0, W } from "./fixtures";

const ADDR = "0x43d894e229a008c72e96872739719b9cfda941d5";
const HASH = "0x1b43836d44c8332012562431381356f8388c8a7dd3f77a33fbff10498cad0483";

describe("classifyInput", () => {
  it("recognises addresses and hashes (case-insensitive, trimmed)", () => {
    expect(classifyInput(`  ${ADDR.toUpperCase().replace("0X", "0x")} `)).toEqual({ kind: "address", value: ADDR });
    expect(classifyInput(HASH)).toEqual({ kind: "tx", value: HASH });
  });

  it("explains invalid input", () => {
    expect(classifyInput("").kind).toBe("empty");
    expect(classifyInput("hello")).toMatchObject({ kind: "invalid" });
    expect(classifyInput("vitalik.eth")).toMatchObject({ kind: "invalid", reason: expect.stringMatching(/Name lookups/) });
    expect(classifyInput(ADDR.slice(2))).toMatchObject({ kind: "invalid", reason: expect.stringMatching(/0x prefix/) });
    expect(classifyInput("0x1234")).toMatchObject({ kind: "invalid", reason: expect.stringMatching(/too short/) });
    expect(classifyInput(`0x${"a".repeat(50)}`)).toMatchObject({ kind: "invalid" });
    expect(classifyInput(`0x${"a".repeat(200)}`)).toMatchObject({ kind: "invalid", reason: expect.stringMatching(/too long/) });
    expect(classifyInput("<script>alert(1)</script>")).toMatchObject({ kind: "invalid" });
  });
});

describe("API request validation", () => {
  const allowed = ["24h", "3d", "7d"] as const;

  it("accepts valid wallet requests and normalises the address", () => {
    const v = validateWalletRequest(ADDR.toUpperCase().replace("0X", "0x"), null, [...allowed]);
    expect(v).toEqual({ ok: true, value: { address: ADDR, window: "24h" } });
  });

  it("rejects bad addresses, unknown windows and windows disabled on this deployment", () => {
    expect(validateWalletRequest("0x123", "24h", [...allowed])).toEqual({ ok: false, code: "INVALID_ADDRESS" });
    expect(validateWalletRequest(undefined, "24h", [...allowed])).toEqual({ ok: false, code: "INVALID_ADDRESS" });
    expect(validateWalletRequest(`${ADDR}${"0".repeat(200)}`, "24h", [...allowed])).toEqual({ ok: false, code: "INVALID_ADDRESS" });
    expect(validateWalletRequest(ADDR, "1y", [...allowed])).toEqual({ ok: false, code: "INVALID_WINDOW" });
    expect(validateWalletRequest(ADDR, "all", [...allowed])).toEqual({ ok: false, code: "INVALID_WINDOW" });
  });

  it("validates transaction hashes", () => {
    expect(validateTxRequest(HASH.toUpperCase().replace("0X", "0x"))).toEqual({ ok: true, value: HASH });
    expect(validateTxRequest(ADDR)).toEqual({ ok: false, code: "INVALID_HASH" });
    expect(validateTxRequest("0x' OR 1=1 --")).toEqual({ ok: false, code: "INVALID_HASH" });
  });
});

describe("decodeMovements", () => {
  it("keeps native USDC logs, drops the mirrored ERC-20 USDC log, labels known tokens", () => {
    const moves = decodeMovements([
      log(A, W, 5, 1, T0, 0),
      log(A, W, 5, 1, T0, 1, { address: "0x3600000000000000000000000000000000000000", data: "0x4c4b40" }),
      log(A, W, 0, 1, T0, 2, { address: "0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1", data: "0x0f4240" }),
      log(A, W, 0, 1, T0, 3, { address: "0x9999999999999999999999999999999999999999", data: "0x01" }),
    ]);
    expect(moves).toHaveLength(3);
    expect(moves[0]).toMatchObject({ token: "USDC", value: 5, recognised: true });
    expect(moves[1]).toMatchObject({ token: "EURC", value: 1, decimals: 6 });
    expect(moves[2]).toMatchObject({ token: "Unrecognized token", value: null, recognised: false });
  });
});
