"use client";

import { useState } from "react";
import { DAY_NAMES, formatHour, formatInt, formatUsd } from "@/lib/format";
import type { ActivityHeatmapPoint } from "@/lib/types";

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Monday-first display order.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Sequential single-hue ramp (Arc blue), light→strong on the dark surface. */
function cellColor(v: number, max: number) {
  if (v <= 0 || max <= 0) return "rgba(255,255,255,0.035)";
  const t = Math.sqrt(v / max); // perceptual boost for sparse data
  const a = 0.14 + t * 0.86;
  return `rgba(95,143,224,${a.toFixed(3)})`;
}

export function Heatmap({ data }: { data: ActivityHeatmapPoint[] }) {
  const [hover, setHover] = useState<ActivityHeatmapPoint | null>(null);
  const max = Math.max(0, ...data.map((d) => d.count));
  const grid = new Map(data.map((d) => [`${d.day}:${d.hour}`, d]));

  return (
    <div>
      <div className="scroll-x">
        <div
          role="grid"
          aria-label="Transfers by UTC day of week and hour of day"
          className="grid min-w-[520px] gap-[3px]"
          style={{ gridTemplateColumns: "36px repeat(24, minmax(0, 1fr))" }}
        >
          <div role="row" className="contents">
            <span role="columnheader" />
            {Array.from({ length: 24 }, (_, h) => (
              <span role="columnheader" key={h} className="text-center font-mono text-[9.5px] text-faint">
                {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
                <span className="sr-only">{formatHour(h)} UTC</span>
              </span>
            ))}
          </div>
          {ORDER.map((day) => (
            <div role="row" key={day} className="contents">
              <span role="rowheader" className="self-center font-mono text-[10px] text-muted">
                {DAYS_SHORT[day]}
              </span>
              {Array.from({ length: 24 }, (_, hour) => {
                const c = grid.get(`${day}:${hour}`)!;
                const label = `${DAY_NAMES[day]} ${formatHour(hour)} UTC: ${formatInt(c.count)} transfers, ${formatUsd(c.volume)}`;
                return (
                  <button
                    type="button"
                    role="gridcell"
                    key={hour}
                    aria-label={label}
                    onPointerEnter={() => setHover(c)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(c)}
                    onBlur={() => setHover(null)}
                    className="aspect-square min-h-3 rounded-[3px] transition-[transform,box-shadow] duration-150 hover:scale-110 hover:shadow-[0_0_0_1.5px_var(--ink)] focus-visible:scale-110 focus-visible:outline-none focus-visible:shadow-[0_0_0_1.5px_var(--accent)]"
                    style={{ background: cellColor(c.count, max) }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <p className="min-h-4 tabular" aria-live="polite">
          {hover ? (
            <>
              <span className="text-ink">
                {DAY_NAMES[hover.day]} {formatHour(hover.hour)}–{formatHour((hover.hour + 1) % 24)} UTC
              </span>{" "}
              · {formatInt(hover.count)} transfers · {formatUsd(hover.volume)}
            </>
          ) : (
            "Hover or focus a cell for exact values. All times are UTC."
          )}
        </p>
        <div className="flex items-center gap-2" aria-hidden="true">
          <span>Less</span>
          {[0, 0.1, 0.3, 0.6, 1].map((t) => (
            <span key={t} className="size-3 rounded-[3px]" style={{ background: cellColor(t * Math.max(1, max), Math.max(1, max)) }} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
