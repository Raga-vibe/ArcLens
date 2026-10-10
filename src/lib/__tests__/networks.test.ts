import { describe, expect, it } from "vitest";
import { NETWORKS, explorerTxUrl, isNetworkKey } from "@/lib/networks";

describe("supported networks", () => {
  it("keeps the Arc mainnet and Robinhood Chain Testnet configurations distinct", () => {
    expect(NETWORKS["arc-mainnet"]).toMatchObject({ chainId: 5042, nativeCurrency: { symbol: "USDC", decimals: 18 } });
    expect(NETWORKS["robinhood-testnet"]).toMatchObject({
      chainId: 46630,
      explorer: "https://explorer.testnet.chain.robinhood.com",
      nativeCurrency: { symbol: "ETH", decimals: 18 },
    });
  });

  it("validates network keys and creates network-specific transaction links", () => {
    expect(isNetworkKey("robinhood-testnet")).toBe(true);
    expect(isNetworkKey("robinhood-mainnet")).toBe(false);
    expect(explorerTxUrl("0xabc", "robinhood-testnet")).toBe("https://explorer.testnet.chain.robinhood.com/tx/0xabc");
  });
});
