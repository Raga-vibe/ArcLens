"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatAssetValue, formatInt, formatPct, shortAddress } from "@/lib/format";
import type { Counterparty } from "@/lib/types";
import type { NetworkKey, WalletAsset } from "@/lib/networks";
import { useWidth } from "./useSize";

interface Side {
  key: string;
  address: string | null; // null = "other"
  label: string;
  volume: number;
  count: number;
}

const TOP = 6;

function side(cps: Counterparty[], dir: "in" | "out", total: number, totalCount: number): Side[] {
  const vol = (c: Counterparty) => (dir === "in" ? c.inVolume : c.outVolume);
  const cnt = (c: Counterparty) => (dir === "in" ? c.inCount : c.outCount);
  const list = cps.filter((c) => vol(c) > 0).sort((a, b) => vol(b) - vol(a));
  const top: Side[] = list.slice(0, TOP).map((c) => ({
    key: `${dir}:${c.address}`,
    address: c.address,
    label: c.label?.name ?? shortAddress(c.address),
    volume: vol(c),
    count: cnt(c),
  }));
  const topVol = top.reduce((s, x) => s + x.volume, 0);
  const topCnt = top.reduce((s, x) => s + x.count, 0);
  const restVol = total - topVol;
  if (restVol > total * 0.001) {
    top.push({ key: `${dir}:other`, address: null, label: "All others", volume: restVol, count: Math.max(0, totalCount - topCnt) });
  }
  return top;
}

/**
 * Value flow: top senders → wallet → top recipients. Ribbon width ∝ selected-asset volume.
 * `inTotal`/`outTotal` come from full-window stats so "All others" is exact even
 * though only the top counterparties are sent to the client.
 */
export function FlowDiagram({
  counterparties,
  inTotal,
  outTotal,
  inCount,
  outCount,
  asset,
  network,
}: {
  counterparties: Counterparty[];
  inTotal: number;
  outTotal: number;
  inCount: number;
  outCount: number;
  asset: WalletAsset;
  network: NetworkKey;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const router = useRouter();
  const amount = (value: number, compact = false) => formatAssetValue(value, asset, network, { compact });
  const left = useMemo(() => side(counterparties, "in", inTotal, inCount), [counterparties, inTotal, inCount]);
  const right = useMemo(() => side(counterparties, "out", outTotal, outCount), [counterparties, outTotal, outCount]);

  const narrow = width < 620;
  if (narrow)
    return (
      <div ref={ref}>
        <FlowList left={left} right={right} inTotal={inTotal} outTotal={outTotal} amount={amount} network={network} />
      </div>
    );

  const labelW = 150;
  const nodeW = 8;
  const cx = width / 2;
  const pad = 8;
  const MIN_SLOT = 30;
  const grand = Math.max(inTotal, outTotal, 1e-9);
  // Ribbon thickness budget; each node gets a slot of at least MIN_SLOT so labels never collide.
  const BUDGET = 260;
  const hubH = BUDGET;
  const scale = BUDGET / grand;
  const slotsOf = (items: Side[]) => items.map((it) => Math.max(MIN_SLOT, it.volume * scale));
  const usedOf = (slots: number[]) => slots.reduce((a, b) => a + b, 0) + pad * Math.max(0, slots.length - 1);
  const inner = Math.max(hubH, usedOf(slotsOf(left)), usedOf(slotsOf(right)));
  const TOP_Y = 34;
  const H = inner + TOP_Y + 34;

  function layout(items: Side[], total: number) {
    const slots = slotsOf(items);
    let yy = TOP_Y + (inner - usedOf(slots)) / 2;
    let hubY = TOP_Y + (inner - total * scale) / 2;
    return items.map((it, i) => {
      const h = Math.max(2, it.volume * scale);
      const o = { ...it, y: yy + (slots[i] - h) / 2, h, hubY, hubH: Math.max(1.5, h) };
      yy += slots[i] + pad;
      hubY += it.volume * scale;
      return o;
    });
  }
  const L = layout(left, inTotal);
  const R = layout(right, outTotal);
  const xL = labelW;
  const xR = width - labelW;
  const hubX0 = cx - 14;
  const hubX1 = cx + 14;

  const ribbon = (x0: number, y0: number, h0: number, x1: number, y1: number, h1: number) => {
    const mx = (x0 + x1) / 2;
    return `M${x0},${y0}C${mx},${y0} ${mx},${y1} ${x1},${y1}V${y1 + h1}C${mx},${y1 + h1} ${mx},${y0 + h0} ${x0},${y0 + h0}Z`;
  };

  const go = (a: string | null) => a && router.push(`/wallet/${a}?network=${network}`);

  return (
    <div ref={ref} className="relative">
      <svg width={width} height={H} role="img" aria-label={`Flow of ${asset.symbol} from top senders into the wallet and out to top recipients. Ribbon width is proportional to volume.`}>
        <text x={xL} y={16} textAnchor="end" className="fill-[var(--muted)] font-mono text-[10px] tracking-widest">SENDERS ↓ IN</text>
        <text x={xR} y={16} className="fill-[var(--muted)] font-mono text-[10px] tracking-widest">OUT ↑ RECIPIENTS</text>

        {L.map((n, i) => (
          <motion.path
            key={n.key}
            d={ribbon(xL + nodeW, n.y, n.h, hubX0, n.hubY, n.hubH)}
            fill="var(--series-in)"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: hover ? (hover === n.key ? 0.7 : 0.1) : 0.3 }}
            transition={{ duration: 0.5, delay: reduce ? 0 : i * 0.05 }}
          />
        ))}
        {R.map((n, i) => (
          <motion.path
            key={n.key}
            d={ribbon(hubX1, n.hubY, n.hubH, xR - nodeW, n.y, n.h)}
            fill="var(--series-out)"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: hover ? (hover === n.key ? 0.7 : 0.1) : 0.3 }}
            transition={{ duration: 0.5, delay: reduce ? 0 : 0.2 + i * 0.05 }}
          />
        ))}

        <rect x={hubX0} y={TOP_Y + (inner - hubH) / 2} width={hubX1 - hubX0} height={hubH} rx={4} fill="var(--elevated-2)" stroke="var(--line-strong)" />
        <text x={cx} y={TOP_Y + (inner + hubH) / 2 + 18} textAnchor="middle" className="fill-[var(--ink-2)] text-[11px]">This wallet</text>

        {[...L.map((n) => ({ n, dir: "in" as const })), ...R.map((n) => ({ n, dir: "out" as const }))].map(({ n, dir }) => {
          const isL = dir === "in";
          const total = isL ? inTotal : outTotal;
          return (
            <g
              key={n.key}
              onPointerEnter={() => setHover(n.key)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(n.key)}
              onBlur={() => setHover(null)}
              onClick={() => go(n.address)}
              onKeyDown={(e) => e.key === "Enter" && go(n.address)}
              tabIndex={n.address ? 0 : -1}
              role={n.address ? "link" : undefined}
              aria-label={`${isL ? "From" : "To"} ${n.address ?? "all other counterparties"}: ${amount(n.volume)}, ${formatInt(n.count)} transfers`}
              className={n.address ? "cursor-pointer outline-none" : undefined}
            >
              <rect x={isL ? xL : xR - nodeW} y={n.y} width={nodeW} height={n.h} rx={2} fill={isL ? "var(--series-in)" : "var(--series-out)"} />
              <rect x={isL ? 0 : xR} y={n.y + n.h / 2 - 18} width={labelW} height={36} fill="transparent" />
              <text
                x={isL ? xL - 10 : xR + 10}
                y={n.y + n.h / 2 - 3}
                textAnchor={isL ? "end" : "start"}
                className={`font-mono text-[11px] ${hover === n.key ? "fill-[var(--accent)]" : n.address ? "fill-[var(--ink-2)]" : "fill-[var(--muted)]"}`}
              >
                {n.label}
              </text>
              <text x={isL ? xL - 10 : xR + 10} y={n.y + n.h / 2 + 11} textAnchor={isL ? "end" : "start"} className="fill-[var(--faint)] text-[10px] tabular">
                {amount(n.volume, true)} · {formatPct(total ? n.volume / total : 0)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function FlowCol({ items, total, dir, amount, network }: { items: Side[]; total: number; dir: "in" | "out"; amount: (value: number, compact?: boolean) => string; network: NetworkKey }) {
  return (
    <div>
      <p className="eyebrow mb-3">{dir === "in" ? "Came from ↓" : "Went to ↑"}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted">No {dir === "in" ? "incoming" : "outgoing"} transfers.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((n) => (
            <li key={n.key}>
              <div className="flex justify-between gap-3 text-xs">
                {n.address ? (
                  <a href={`/wallet/${n.address}?network=${network}`} className="font-mono text-ink-2 hover:text-accent">
                    {n.label}
                  </a>
                ) : (
                  <span className="text-muted">{n.label}</span>
                )}
                <span className="tabular text-muted">{amount(n.volume, true)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-elevated-2">
                <div className={`h-1.5 rounded-full ${dir === "in" ? "bg-in" : "bg-out"}`} style={{ width: `${Math.max(2, (n.volume / Math.max(total, 1e-9)) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FlowList({ left, right, inTotal, outTotal, amount, network }: { left: Side[]; right: Side[]; inTotal: number; outTotal: number; amount: (value: number, compact?: boolean) => string; network: NetworkKey }) {
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      <FlowCol items={left} total={inTotal} dir="in" amount={amount} network={network} />
      <FlowCol items={right} total={outTotal} dir="out" amount={amount} network={network} />
    </div>
  );
}
