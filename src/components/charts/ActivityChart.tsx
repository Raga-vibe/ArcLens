"use client";

import { scaleBand, scaleLinear } from "d3-scale";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { formatDateTime, formatDay, formatInt, formatUsd } from "@/lib/format";
import type { TimeSeriesPoint } from "@/lib/types";
import { useWidth } from "./useSize";

export type SeriesMode = "count" | "volume";

const H = 260;
const M = { top: 16, right: 12, bottom: 28, left: 52 };

/**
 * Stacked in/out bar chart over time. One y-axis; mode switches the measure.
 * Hover or arrow keys move a crosshair; tooltip shows exact values.
 */
export function ActivityChart({
  data,
  mode,
  bucketSeconds,
}: {
  data: TimeSeriesPoint[];
  mode: SeriesMode;
  bucketSeconds: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const innerW = width - M.left - M.right;
  const innerH = H - M.top - M.bottom;

  const inV = (p: TimeSeriesPoint) => (mode === "count" ? p.inCount : p.inVolume);
  const outV = (p: TimeSeriesPoint) => (mode === "count" ? p.outCount : p.outVolume);

  const x = useMemo(
    () => scaleBand<number>().domain(data.map((_, i) => i)).range([0, innerW]).paddingInner(data.length > 90 ? 0.12 : 0.22),
    [data, innerW],
  );
  const max = useMemo(() => Math.max(1e-9, ...data.map((p) => inV(p) + outV(p))), [data, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const y = useMemo(() => scaleLinear().domain([0, max]).nice(4).range([innerH, 0]), [max, innerH]);
  const ticks = y.ticks(4);
  const fmtTick = (v: number) => (mode === "count" ? formatInt(v) : formatUsd(v, { compact: true }).replace(".00", ""));

  // ~6 x labels, aligned to bucket boundaries
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(3, Math.floor(innerW / 110))));
  const multiDay = data.length > 0 && data[data.length - 1].t - data[0].t > 86_400;
  const fmtX = (t: number) => {
    const d = new Date(t * 1000);
    const hh = `${String(d.getUTCHours()).padStart(2, "0")}:00`;
    return multiDay && d.getUTCHours() === 0 ? formatDay(t) : multiDay && bucketSeconds >= 86_400 ? formatDay(t) : hh;
  };

  const bw = x.bandwidth();
  const r = Math.min(4, bw / 2);
  const p = active !== null ? data[active] : null;

  function onMove(clientX: number, target: SVGSVGElement) {
    const rect = target.getBoundingClientRect();
    const px = clientX - rect.left - M.left;
    const step = x.step();
    const i = Math.max(0, Math.min(data.length - 1, Math.floor(px / step)));
    setActive(i);
  }

  const label = `Stacked bar chart of ${mode === "count" ? "USDC transfer count" : "USDC volume"} per ${bucketSeconds >= 86_400 ? "day" : bucketSeconds >= 3600 * 2 ? `${bucketSeconds / 3600} hours` : "hour"}, split into incoming and outgoing. Use arrow keys to inspect values.`;

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={label}
        tabIndex={0}
        className="block touch-pan-y select-none focus-visible:outline-offset-4"
        onPointerMove={(e) => onMove(e.clientX, e.currentTarget)}
        onPointerLeave={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setActive((a) => Math.min(data.length - 1, (a ?? -1) + 1));
          else if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? data.length) - 1));
          else if (e.key === "Escape") setActive(null);
          else return;
          e.preventDefault();
        }}
        onBlur={() => setActive(null)}
      >
        <g transform={`translate(${M.left},${M.top})`}>
          {ticks.map((t) => (
            <g key={t} transform={`translate(0,${y(t)})`}>
              <line x1={0} x2={innerW} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : "2 4"} />
              <text x={-10} dy="0.32em" textAnchor="end" className="fill-[var(--faint)] font-mono text-[10px]">
                {fmtTick(t)}
              </text>
            </g>
          ))}
          {active !== null && (
            <rect x={(x(active) ?? 0) - (x.step() - bw) / 2} width={x.step()} y={0} height={innerH} fill="rgba(255,255,255,0.035)" />
          )}
          {data.map((d, i) => {
            const xi = x(i) ?? 0;
            const hi = innerH - y(inV(d));
            const ho = innerH - y(outV(d));
            const dim = active !== null && active !== i ? 0.45 : 1;
            const gap = hi > 0 && ho > 0 ? 2 : 0;
            return (
              <g key={d.t} opacity={dim} style={{ transition: "opacity 150ms" }}>
                {hi > 0 && (
                  <motion.path
                    initial={reduce ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.7, delay: reduce ? 0 : Math.min(0.5, i * 0.006), ease: [0.22, 1, 0.36, 1] }}
                    style={{ originY: `${innerH}px`, transformBox: "view-box" }}
                    d={barPath(xi, innerH - hi, bw, hi, ho > 0 ? 0 : r, 0)}
                    fill="var(--series-in)"
                  />
                )}
                {ho > 0 && (
                  <motion.path
                    initial={reduce ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.7, delay: reduce ? 0 : Math.min(0.5, i * 0.006), ease: [0.22, 1, 0.36, 1] }}
                    style={{ originY: `${innerH}px`, transformBox: "view-box" }}
                    d={barPath(xi, innerH - hi - ho, bw, Math.max(0, ho - gap), r, 0)}
                    fill="var(--series-out)"
                  />
                )}
              </g>
            );
          })}
          {data.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={d.t} x={(x(i) ?? 0) + bw / 2} y={innerH + 18} textAnchor="middle" className="fill-[var(--faint)] font-mono text-[10px]">
                {fmtX(d.t)}
              </text>
            ) : null,
          )}
        </g>
      </svg>

      {p && active !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-52 rounded-lg border border-line-strong bg-elevated/95 p-3 text-xs shadow-xl backdrop-blur"
          style={{
            left: Math.min(width - 216, Math.max(0, M.left + (x(active) ?? 0) + bw / 2 + 12 - (M.left + (x(active) ?? 0) > width / 2 ? 232 : 0))),
          }}
          role="status"
        >
          <p className="mb-2 font-mono text-[10.5px] text-muted">{formatDateTime(p.t)}</p>
          <Row color="var(--series-in)" label="Incoming" value={mode === "count" ? formatInt(p.inCount) : formatUsd(p.inVolume)} />
          <Row color="var(--series-out)" label="Outgoing" value={mode === "count" ? formatInt(p.outCount) : formatUsd(p.outVolume)} />
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-ink">
            <span>Total</span>
            <span className="tabular">{mode === "count" ? `${formatInt(p.count)} transfers` : formatUsd(p.volume)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-ink-2">
      <span className="flex items-center gap-2">
        <span className="size-2 rounded-sm" style={{ background: color }} aria-hidden="true" />
        {label}
      </span>
      <span className="tabular text-ink">{value}</span>
    </div>
  );
}

/** Rect with rounded top corners (radius rt) and bottom corners (rb). */
function barPath(x: number, y: number, w: number, h: number, rt: number, rb: number) {
  if (h <= 0) return "";
  const t = Math.min(rt, h / 2, w / 2);
  const b = Math.min(rb, h / 2, w / 2);
  return `M${x},${y + t}Q${x},${y} ${x + t},${y}H${x + w - t}Q${x + w},${y} ${x + w},${y + t}V${y + h - b}Q${x + w},${y + h} ${x + w - b},${y + h}H${x + b}Q${x},${y + h} ${x},${y + h - b}Z`;
}

export function ChartLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-in" aria-hidden="true" /> Incoming ↓
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-out" aria-hidden="true" /> Outgoing ↑
      </span>
    </div>
  );
}
