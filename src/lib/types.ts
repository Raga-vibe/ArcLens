// Shared domain types. Everything here is serialisable (no bigint) so it can
// cross the server → client boundary as JSON.

export type Hex = `0x${string}`;
export type Address = Hex;

export type Direction = "in" | "out";

/** A single USDC movement reconstructed from an EIP-7708 native Transfer log. */
export interface TokenTransfer {
  /** `${txHash}:${logIndex}` — unique per movement. */
  id: string;
  txHash: Hex;
  logIndex: number;
  blockNumber: number;
  /** Unix seconds. Arc timestamps have 1 s granularity; order by block. */
  timestamp: number;
  from: Address;
  to: Address;
  /** Raw 18-decimal native amount as a decimal string (lossless). */
  valueRaw: string;
  /** Amount in USDC as a float (6-decimal precision), for analytics. */
  value: number;
  token: "USDC";
}

/** A transfer seen from the analysed wallet's perspective. */
export interface Transaction extends TokenTransfer {
  direction: Direction;
  counterparty: Address;
}

export type AddressKind = "contract" | "account" | "unknown";

/** Verified label: only sourced from official Arc documentation. */
export interface AddressLabel {
  name: string;
  source: string;
}

export interface Counterparty {
  address: Address;
  kind: AddressKind;
  label?: AddressLabel;
  txCount: number;
  inCount: number;
  outCount: number;
  inVolume: number;
  outVolume: number;
  totalVolume: number;
  firstSeen: number;
  lastSeen: number;
  /** Net direction with this counterparty from the wallet's perspective. */
  dominant: Direction | "both";
}

export interface ScanWindow {
  key: WindowKey;
  fromBlock: number;
  toBlock: number;
  fromTimestamp: number;
  toTimestamp: number;
}

export type WindowKey = "24h" | "3d" | "7d" | "30d" | "all";

export interface Wallet {
  address: Address;
  isContract: boolean;
  label?: AddressLabel;
  /** Current native USDC balance (full precision via eth_getBalance). */
  balance: number;
  balanceRaw: string;
  /** eth_getTransactionCount — transactions ever sent by this address (all-time). */
  nonce: number;
}

export interface WalletStats {
  transferCount: number;
  txCount: number;
  inCount: number;
  outCount: number;
  totalVolume: number;
  inVolume: number;
  outVolume: number;
  netFlow: number;
  uniqueCounterparties: number;
  firstActivity: number | null;
  latestActivity: number | null;
  average: number | null;
  median: number | null;
  largest: Transaction | null;
  activeHours: number;
  activeDays: number;
  /** Share of outgoing volume that went to the top-3 recipients (0–1). */
  top3OutShare: number | null;
  /** Share of incoming volume from the top-3 senders (0–1). */
  top3InShare: number | null;
  /** Herfindahl–Hirschman index of counterparty volume (0–1). */
  hhi: number | null;
  /** Coefficient of variation of transfers per active-window hour. */
  hourlyVolatility: number | null;
  /** in/out volume ratio; null when there is no outgoing volume. */
  inOutRatio: number | null;
}

export interface TimeSeriesPoint {
  /** Bucket start, unix seconds. */
  t: number;
  count: number;
  inCount: number;
  outCount: number;
  volume: number;
  inVolume: number;
  outVolume: number;
}

export interface ActivityHeatmapPoint {
  /** 0 = Sunday … 6 = Saturday (UTC). */
  day: number;
  /** 0–23 UTC. */
  hour: number;
  count: number;
  volume: number;
}

export interface PeriodComparison {
  currentCount: number;
  previousCount: number;
  currentVolume: number;
  previousVolume: number;
  /** Fractional change, null when previous is zero. */
  countChange: number | null;
  volumeChange: number | null;
  splitAt: number;
}

export type InsightTone = "neutral" | "positive" | "negative" | "notice";

export interface WalletInsight {
  id: string;
  title: string;
  body: string;
  tone: InsightTone;
  /** The number the statement is derived from, for traceability. */
  metric?: string;
}

export interface WalletReport {
  wallet: Wallet;
  window: ScanWindow;
  latestBlock: number;
  generatedAt: number;
  /** Most recent transfers (capped for payload size). */
  transactions: Transaction[];
  transactionsTotal: number;
  stats: WalletStats;
  /** Top counterparties by volume (capped). */
  counterparties: Counterparty[];
  counterpartiesTotal: number;
  timeSeries: TimeSeriesPoint[];
  bucketSeconds: number;
  heatmap: ActivityHeatmapPoint[];
  comparison: PeriodComparison | null;
  summary: string[];
  insights: WalletInsight[];
  source: DataSourceInfo;
}

export interface DataSourceInfo {
  kind: "rpc-logs";
  description: string;
  maxWindow: WindowKey;
}

// ---- Transaction page -----------------------------------------------------

export interface TxTokenMovement {
  token: string;
  tokenAddress: Address;
  decimals: number | null;
  from: Address;
  to: Address;
  valueRaw: string;
  value: number | null;
  logIndex: number;
  recognised: boolean;
}

export interface TransactionInsight {
  hash: Hex;
  status: "success" | "reverted";
  blockNumber: number;
  timestamp: number;
  confirmations: number;
  from: Address;
  fromLabel?: AddressLabel;
  to: Address | null;
  toLabel?: AddressLabel;
  toIsContract: boolean;
  contractCreated: Address | null;
  /** Native value attached to the tx, in USDC. */
  value: number;
  valueRaw: string;
  fee: number;
  feeRaw: string;
  gasUsed: number;
  nonce: number;
  methodSelector: Hex | null;
  type: number;
  movements: TxTokenMovement[];
  /** USDC moved (native EIP-7708 stream), summed. */
  usdcMoved: number;
  logCount: number;
  explanation: string[];
}

// ---- API envelopes --------------------------------------------------------

export type ErrorCode =
  | "INVALID_ADDRESS"
  | "INVALID_HASH"
  | "INVALID_WINDOW"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "INTERNAL";

export interface ErrorResponse {
  ok: false;
  error: { code: ErrorCode; message: string; retryAfter?: number };
}

export interface SuccessResponse<T> {
  ok: true;
  data: T;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export type AnalysisStage =
  | "connect"
  | "fetch"
  | "normalize"
  | "stats"
  | "intelligence";

/** NDJSON stream events from /api/wallet/[address]. */
export type WalletStreamEvent =
  | { type: "stage"; stage: AnalysisStage }
  | { type: "progress"; done: number; total: number; found: number }
  | { type: "result"; data: WalletReport }
  | { type: "error"; error: ErrorResponse["error"] };
