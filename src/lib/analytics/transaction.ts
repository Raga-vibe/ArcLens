import { KNOWN_TOKENS, labelFor, NATIVE_TRANSFER_EMITTER, TRANSFER_TOPIC } from "@/lib/arc/chain";
import { formatAssetValue, formatDateTime, formatInt, formatUsd, shortAddress } from "@/lib/format";
import type { Address, Hex, TransactionInsight, TxTokenMovement } from "@/lib/types";
import { getNetwork, type NetworkKey, type WalletAsset } from "@/lib/networks";
import { topicToAddress, toUnits, type RawLog } from "./normalize";

export interface RawTx {
  hash: Hex;
  from: Address;
  to: Address | null;
  value: string;
  nonce: string;
  input: string;
  blockNumber: string | null;
  type: string;
}

export interface RawReceipt {
  status: string;
  gasUsed: string;
  effectiveGasPrice: string;
  contractAddress: Address | null;
  logs: RawLog[];
  blockNumber: string;
}

const n = (h: string | null | undefined) => (h ? Number.parseInt(h, 16) : 0);
const big = (h: string | null | undefined) => {
  try {
    return h && h !== "0x" ? BigInt(h) : BigInt(0);
  } catch {
    return BigInt(0);
  }
};

/** Decode Transfer logs in a receipt into token movements. */
export function decodeMovements(logs: RawLog[], network: NetworkKey = "arc-mainnet"): TxTokenMovement[] {
  const out: TxTokenMovement[] = [];
  for (const l of logs) {
    if (l.topics?.[0]?.toLowerCase() !== TRANSFER_TOPIC || l.topics.length !== 3) continue; // ERC-721 has 4 topics
    const emitter = l.address.toLowerCase();
    const raw = big(l.data);
    const common = {
      from: topicToAddress(l.topics[1]),
      to: topicToAddress(l.topics[2]),
      valueRaw: raw.toString(),
      logIndex: n(l.logIndex),
    };
    if (network === "arc-mainnet" && emitter === NATIVE_TRANSFER_EMITTER) {
      out.push({ ...common, token: "USDC", tokenAddress: NATIVE_TRANSFER_EMITTER, decimals: 18, value: toUnits(raw, 18), recognised: true });
      continue;
    }
    // USDC's ERC-20 interface mirrors the native log; skip to avoid double counting.
    if (network === "arc-mainnet" && emitter === "0x3600000000000000000000000000000000000000") continue;
    const known = network === "arc-mainnet" ? KNOWN_TOKENS[emitter] : undefined;
    out.push({
      ...common,
      token: known?.symbol ?? (network === "arc-mainnet" ? "Unrecognized token" : "ERC-20"),
      tokenAddress: emitter as Address,
      decimals: known?.decimals ?? null,
      value: known ? toUnits(raw, known.decimals) : null,
      recognised: !!known,
      assetKey: emitter,
      assetKind: "erc20",
    });
  }
  return out;
}

export function buildTransactionInsight(input: {
  tx: RawTx;
  receipt: RawReceipt;
  timestamp: number;
  latest: number;
  toIsContract: boolean;
  network?: NetworkKey;
  movements?: TxTokenMovement[];
}): TransactionInsight {
  const { tx, receipt, timestamp, latest, toIsContract } = input;
  const networkKey = input.network ?? "arc-mainnet";
  const chain = getNetwork(networkKey);
  const nativeAsset: WalletAsset = { key: "native", symbol: chain.nativeCurrency.symbol, decimals: chain.nativeCurrency.decimals, address: null, kind: "native" };
  const blockNumber = n(receipt.blockNumber);
  const valueRaw = big(tx.value);
  const feeRaw = big(receipt.gasUsed) * big(receipt.effectiveGasPrice);
  const movements = input.movements ?? decodeMovements(receipt.logs ?? [], networkKey);
  const usdc = movements.filter((m) => m.token === "USDC" && m.tokenAddress === NATIVE_TRANSFER_EMITTER);
  const usdcMoved = usdc.reduce((s, m) => s + (m.value ?? 0), 0);
  const status = n(receipt.status) === 1 ? "success" : "reverted";
  const from = tx.from.toLowerCase() as Address;
  const to = tx.to ? (tx.to.toLowerCase() as Address) : null;
  const nonce = n(tx.nonce);
  const selector = tx.input && tx.input.length >= 10 ? (tx.input.slice(0, 10) as Hex) : null;
  const fee = toUnits(feeRaw, 18);
  const value = toUnits(valueRaw, 18);

  const explanation: string[] = [];
  if (status === "reverted") {
    explanation.push(networkKey === "arc-mainnet"
      ? `This transaction was included in block ${formatInt(blockNumber)} but reverted. No state changes or USDC transfers took effect; the sender still paid ${formatUsd(fee, { precise: true })} in gas.`
      : `This transaction was included in block ${formatInt(blockNumber)} but reverted. Its value and token state changes did not take effect; the sender still paid ${formatAssetValue(fee, nativeAsset, networkKey, { precise: true })} in gas.`);
  } else if (!to && receipt.contractAddress) {
    explanation.push(`${shortAddress(from)} deployed a new contract at ${shortAddress(receipt.contractAddress)}.`);
  } else if (networkKey === "arc-mainnet" && usdc.length === 1) {
    const m = usdc[0];
    explanation.push(`${formatUsd(m.value ?? 0, { precise: true })} USDC moved from ${shortAddress(m.from)} to ${shortAddress(m.to)}.`);
  } else if (networkKey === "arc-mainnet" && usdc.length > 1) {
    const largest = Math.max(...usdc.map((m) => m.value ?? 0));
    explanation.push(`${formatInt(usdc.length)} separate USDC transfer legs occurred in this transaction. The largest single leg was ${formatUsd(largest, { precise: true })}; all legs sum to ${formatUsd(usdcMoved, { precise: true })}. Legs can pass the same funds along a route, so the sum may count the same dollars more than once.`);
  } else if (networkKey !== "arc-mainnet" && valueRaw > 0n) {
    explanation.push(`${formatAssetValue(value, nativeAsset, networkKey, { precise: true })} of native value moved from ${shortAddress(from)} to ${shortAddress(to ?? receipt.contractAddress ?? from)}.`);
  } else if (selector) {
    explanation.push(`${shortAddress(from)} called ${toIsContract ? "contract" : "address"} ${to ? shortAddress(to) : ""} (method selector ${selector}). No ${networkKey === "arc-mainnet" ? "USDC" : "native ETH"} value was sent.`);
  } else {
    explanation.push(`${shortAddress(from)} sent a transaction to ${to ? shortAddress(to) : "—"} with no ${networkKey === "arc-mainnet" ? "USDC" : "native ETH"} value sent.`);
  }
  const others = movements.filter((m) => m.tokenAddress !== NATIVE_TRANSFER_EMITTER);
  if (others.length) {
    const names = [...new Set(others.map((m) => m.token))].join(", ");
    explanation.push(`It also emitted ${formatInt(others.length)} ERC-20 transfer log${others.length === 1 ? "" : "s"} (${names}).`);
  }
  explanation.push(networkKey === "arc-mainnet"
    ? `Confirmed in block ${formatInt(blockNumber)} at ${formatDateTime(timestamp)}. Arc finality is deterministic: the transaction was final on inclusion.`
    : `Included in Robinhood Chain Testnet block ${formatInt(blockNumber)} at ${formatDateTime(timestamp)}.`);
  explanation.push(
    nonce === 0
      ? `This was the first transaction ever sent by ${shortAddress(from)}.`
      : `${shortAddress(from)} had sent ${formatInt(nonce)} transaction${nonce === 1 ? "" : "s"} before this one (its nonce).`,
  );
  explanation.push(networkKey === "arc-mainnet"
    ? `Gas fee: ${formatUsd(fee, { precise: true })} USDC (Arc charges gas in USDC).`
    : `Gas fee: ${formatAssetValue(fee, nativeAsset, networkKey, { precise: true })}.`);

  return {
    network: networkKey,
    networkName: chain.name,
    chainId: chain.chainId,
    explorer: chain.explorer,
    nativeCurrencySymbol: chain.nativeCurrency.symbol,
    feeCurrencySymbol: chain.nativeCurrency.symbol,
    hash: tx.hash.toLowerCase() as Hex,
    status,
    blockNumber,
    timestamp,
    confirmations: Math.max(0, latest - blockNumber) + 1,
    from,
    fromLabel: networkKey === "arc-mainnet" ? labelFor(from) : undefined,
    to,
    toLabel: to && networkKey === "arc-mainnet" ? labelFor(to) : undefined,
    toIsContract,
    contractCreated: receipt.contractAddress ? (receipt.contractAddress.toLowerCase() as Address) : null,
    value,
    valueRaw: valueRaw.toString(),
    fee,
    feeRaw: feeRaw.toString(),
    gasUsed: n(receipt.gasUsed),
    nonce,
    methodSelector: selector,
    type: n(tx.type),
    movements,
    usdcMoved,
    logCount: receipt.logs?.length ?? 0,
    explanation,
  };
}
