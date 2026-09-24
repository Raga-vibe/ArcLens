"use client";

import { useEffect, useState } from "react";
import { type Address, concat, formatUnits, type Hex } from "viem";
import { CopyButton, ExternalLink } from "@/components/ui/primitives";
import { explorerAddressUrl, explorerTxUrl, REGISTRY_ADDRESS } from "@/lib/arc/chain";
import { create2Factory, registryBytecode, registrySalt } from "@/lib/arc/registry-artifact";
import { connectArc, explainWalletError, readClient, walletClient } from "@/lib/wallet/arc-wallet";

type State =
  | { s: "idle" }
  | { s: "connecting" }
  | { s: "ready"; account: Address; balance: bigint; cost: bigint | null }
  | { s: "confirm"; account: Address }
  | { s: "pending"; account: Address; tx: Hex }
  | { s: "done"; tx: Hex; contract: Address; block: bigint }
  | { s: "error"; message: string; tx?: Hex };

// Deployment goes through the canonical CREATE2 factory: calldata is salt ++ init code.
const deployData = concat([registrySalt, registryBytecode]);

const usd = (wei: bigint) => `$${Number(formatUnits(wei, 18)).toFixed(4)}`;

export function DeployRegistry() {
  const [st, setSt] = useState<State>({ s: "idle" });
  const [live, setLive] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/registry")
      .then((r) => r.json())
      .then((j) => setLive(j.ok ? j.data.deployed : null))
      .catch(() => setLive(null));
  }, []);

  if (live && st.s !== "done") {
    return (
      <div className="panel mt-10 p-5 text-sm">
        <p className="text-good">✓ ArcLensRegistry is deployed on Arc mainnet, and anchoring is switched on.</p>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-ink-2">
          <span className="font-mono text-xs">{REGISTRY_ADDRESS}</span>
          <ExternalLink href={explorerAddressUrl(REGISTRY_ADDRESS)}>Arc Explorer</ExternalLink>
        </p>
      </div>
    );
  }

  async function connect() {
    try {
      setSt({ s: "connecting" });
      const account = await connectArc();
      const client = readClient();
      const [balance, gasPrice, gas] = await Promise.all([
        client.getBalance({ address: account }),
        client.getGasPrice(),
        client.estimateGas({ account, to: create2Factory, data: deployData }).catch(() => null),
      ]);
      setSt({ s: "ready", account, balance, cost: gas ? gas * gasPrice : null });
    } catch (e) {
      setSt({ s: "error", message: explainWalletError(e).message });
    }
  }

  async function deploy(account: Address) {
    let tx: Hex | undefined;
    try {
      setSt({ s: "confirm", account });
      tx = await walletClient(account).sendTransaction({ to: create2Factory, data: deployData });
      setSt({ s: "pending", account, tx });
      const client = readClient();
      const receipt = await client.waitForTransactionReceipt({ hash: tx, timeout: 180_000 });
      if (receipt.status !== "success") throw new Error("reverted");
      const code = await client.getCode({ address: REGISTRY_ADDRESS });
      if (!code || code === "0x") throw new Error("reverted");
      setSt({ s: "done", tx, contract: REGISTRY_ADDRESS, block: receipt.blockNumber });
      setLive(true);
    } catch (e) {
      setSt({ s: "error", message: explainWalletError(e).message, tx });
    }
  }

  return (
    <div className="panel mt-10 space-y-5 p-5" aria-live="polite">
      <ol className="space-y-2 text-sm text-ink-2">
        <li>1. Connect a browser wallet (MetaMask, Rabby…). ArcLens adds the Arc network if it&apos;s missing.</li>
        <li>2. Check you have a little USDC on Arc for the network fee.</li>
        <li>3. Click deploy and approve in your wallet.</li>
      </ol>
      <p className="text-xs text-muted">
        The contract is deployed with CREATE2, so its address is fixed in advance:{" "}
        <span className="break-all font-mono">{REGISTRY_ADDRESS}</span>. ArcLens switches anchoring on as soon as code appears there.
      </p>

      {(st.s === "idle" || st.s === "connecting") && (
        <button type="button" onClick={connect} disabled={st.s === "connecting"} className="rounded-[10px] bg-ink px-4 py-2.5 text-sm font-medium text-bg hover:bg-white disabled:opacity-60">
          {st.s === "connecting" ? "Connecting…" : "Connect wallet"}
        </button>
      )}

      {st.s === "ready" && (
        <div className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="eyebrow">Wallet</dt>
              <dd className="mt-1 font-mono text-xs text-ink-2">{st.account.slice(0, 8)}…{st.account.slice(-6)}</dd>
            </div>
            <div>
              <dt className="eyebrow">USDC on Arc</dt>
              <dd className="mt-1 text-ink">{usd(st.balance)}</dd>
            </div>
            <div>
              <dt className="eyebrow">Estimated fee</dt>
              <dd className="mt-1 text-ink">{st.cost !== null ? `≈ ${usd(st.cost)}` : "Unknown"}</dd>
            </div>
          </dl>
          {st.cost !== null && st.balance < st.cost ? (
            <p className="text-sm text-bad">Not enough USDC on Arc for the fee yet. Add a little USDC to this wallet on Arc, then reconnect.</p>
          ) : (
            <button type="button" onClick={() => deploy(st.account)} className="rounded-[10px] bg-ink px-4 py-2.5 text-sm font-medium text-bg hover:bg-white">
              Deploy ArcLensRegistry to Arc mainnet
            </button>
          )}
        </div>
      )}

      {st.s === "confirm" && <p className="text-sm text-muted">Confirm the deployment in your wallet…</p>}
      {st.s === "pending" && (
        <p className="text-sm text-muted">
          Deploying… <ExternalLink href={explorerTxUrl(st.tx)}>View transaction</ExternalLink>
        </p>
      )}

      {st.s === "done" && (
        <div className="space-y-3 text-sm">
          <p className="text-good">✓ Deployed on Arc mainnet in block {st.block.toString()}.</p>
          <div>
            <p className="eyebrow mb-1">Contract address (paste this into the DoraHacks form)</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="break-all font-mono text-xs text-ink">{st.contract}</code>
              <CopyButton value={st.contract} />
            </div>
          </div>
          <div>
            <p className="eyebrow mb-1">Deployment transaction</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="break-all font-mono text-xs text-ink-2">{st.tx}</code>
              <CopyButton value={st.tx} />
              <ExternalLink href={explorerTxUrl(st.tx)}>Arc Explorer</ExternalLink>
            </div>
          </div>
          <p className="text-muted">The &quot;Anchor on Arc&quot; button on every wallet report is now switched on. No other setup is needed.</p>
        </div>
      )}

      {st.s === "error" && (
        <div className="space-y-3 text-sm">
          <p className="text-bad">{st.message}</p>
          {st.tx && <ExternalLink href={explorerTxUrl(st.tx)}>View transaction</ExternalLink>}
          <button type="button" onClick={() => setSt({ s: "idle" })} className="block rounded-md border border-line px-3 py-1.5 text-muted hover:text-ink">
            Start over
          </button>
        </div>
      )}
    </div>
  );
}
