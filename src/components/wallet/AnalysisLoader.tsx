"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { formatInt } from "@/lib/format";
import type { AnalysisStage } from "@/lib/types";

const STAGES: { key: AnalysisStage; label: string }[] = [
  { key: "connect", label: "Connecting to Arc" },
  { key: "fetch", label: "Fetching activity" },
  { key: "normalize", label: "Normalizing transactions" },
  { key: "stats", label: "Calculating statistics" },
  { key: "intelligence", label: "Building intelligence" },
];

export function AnalysisLoader({
  stage,
  progress,
}: {
  stage: AnalysisStage;
  progress: { done: number; total: number; found: number } | null;
}) {
  const reduce = useReducedMotion();
  const idx = STAGES.findIndex((s) => s.key === stage);
  const pct = progress && progress.total ? progress.done / progress.total : 0;
  const cols = 32;

  return (
    <div className="mx-auto grid max-w-5xl gap-10 py-10 md:grid-cols-[1fr_1.1fr] md:items-center md:py-16" role="status" aria-live="polite">
      <div>
        <p className="eyebrow mb-4">Analyzing on Arc mainnet</p>
        <ol className="space-y-3">
          {STAGES.map((s, i) => {
            const state = i < idx ? "done" : i === idx ? "active" : "todo";
            return (
              <li key={s.key} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`grid size-5 place-items-center rounded-full border text-[10px] transition-colors duration-300 ${
                    state === "done"
                      ? "border-accent/60 bg-accent/15 text-accent"
                      : state === "active"
                        ? "border-accent text-accent"
                        : "border-line text-faint"
                  }`}
                >
                  {state === "done" ? "✓" : state === "active" ? <span className="size-1.5 animate-pulse rounded-full bg-accent" /> : ""}
                </span>
                <span className={`text-[15px] transition-colors ${state === "todo" ? "text-faint" : state === "active" ? "text-ink" : "text-ink-2"}`}>
                  {s.label}
                  <span className="sr-only">{state === "done" ? " (done)" : state === "active" ? " (in progress)" : ""}</span>
                </span>
                {s.key === "fetch" && progress && state !== "todo" && (
                  <span className="ml-auto font-mono text-[11px] text-muted tabular">
                    {formatInt(progress.done)}/{formatInt(progress.total)} ranges · {formatInt(progress.found)} logs
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-6 max-w-sm text-sm text-muted">
          ArcLens scans Arc block ranges directly from the chain. Busy addresses can take up to a minute on the public RPC.
        </p>
      </div>

      {/* Chart-construction visual: bars rise as block ranges complete. */}
      <div className="panel relative overflow-hidden p-5" aria-hidden="true">
        <div className="flex h-44 items-end gap-[3px]">
          {Array.from({ length: cols }, (_, i) => {
            const filled = i / cols < pct || idx > 1;
            const hgt = 18 + ((Math.sin(i * 1.7) + 1) / 2) * 60 + ((i * 37) % 23);
            return (
              <motion.div
                key={i}
                className="flex-1 rounded-t-[3px]"
                initial={false}
                animate={{
                  height: filled ? `${hgt}%` : "6%",
                  backgroundColor: filled ? (i % 5 === 3 ? "#cc7646" : "#5f8fe0") : "rgba(255,255,255,0.06)",
                  opacity: filled ? 0.85 : 1,
                }}
                transition={{ duration: reduce ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            );
          })}
        </div>
        <div className="mt-4 h-px w-full bg-line">
          <motion.div
            className="h-px bg-accent"
            initial={false}
            animate={{ width: `${Math.max(idx > 1 ? 100 : pct * 100, 3)}%` }}
            transition={{ duration: reduce ? 0 : 0.4 }}
          />
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={stage}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-3 font-mono text-[11px] text-muted"
          >
            {STAGES[Math.max(0, idx)]?.label.toUpperCase()}…
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
