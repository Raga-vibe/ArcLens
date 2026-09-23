"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AddressLink, DirectionBadge, EmptyState, KindTag, Segmented } from "@/components/ui/primitives";
import { formatDateTime, formatInt, formatUsd } from "@/lib/format";
import type { Counterparty } from "@/lib/types";

type Filter = "all" | "in" | "out";
type SortKey = "totalVolume" | "txCount" | "lastSeen";

export function CounterpartyTable({ data, total }: { data: Counterparty[]; total: number }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("totalVolume");
  const [limit, setLimit] = useState(10);

  const rows = useMemo(() => {
    const f = data.filter((c) => (filter === "all" ? true : filter === "in" ? c.inCount > 0 : c.outCount > 0));
    const val = (c: Counterparty) =>
      sort === "totalVolume"
        ? filter === "in" ? c.inVolume : filter === "out" ? c.outVolume : c.totalVolume
        : sort === "txCount"
          ? filter === "in" ? c.inCount : filter === "out" ? c.outCount : c.txCount
          : c.lastSeen;
    return [...f].sort((a, b) => val(b) - val(a));
  }, [data, filter, sort]);

  if (!data.length) return <EmptyState title="No counterparties found" body="This address had no USDC transfers with other addresses in the analyzed window." />;

  const Th = ({ k, children, className }: { k?: SortKey; children: React.ReactNode; className?: string }) => (
    <th scope="col" aria-sort={k && sort === k ? "descending" : undefined} className={`px-3 py-2.5 text-left font-normal ${className ?? ""}`}>
      {k ? (
        <button type="button" onClick={() => setSort(k)} className={`inline-flex items-center gap-1 hover:text-ink ${sort === k ? "text-ink" : ""}`}>
          {children}
          <span aria-hidden="true" className={sort === k ? "opacity-100" : "opacity-0"}>↓</span>
        </button>
      ) : (
        children
      )}
    </th>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
        <Segmented
          label="Filter counterparties by direction"
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setLimit(10);
          }}
          options={[
            { value: "all", label: "All" },
            { value: "in", label: "Senders ↓" },
            { value: "out", label: "Recipients ↑" },
          ]}
        />
        <p className="text-xs text-muted">
          {total > data.length ? `Top ${formatInt(data.length)} of ${formatInt(total)} by volume` : `${formatInt(total)} counterparties`}
        </p>
      </div>

      {/* Desktop / tablet table */}
      <div className="scroll-x hidden sm:block">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="sr-only">Counterparties ranked by USDC volume. Select a row to open its ArcLens report.</caption>
          <thead className="border-y border-line text-xs text-muted">
            <tr>
              <th scope="col" className="w-10 px-3 py-2.5 pl-5 text-left font-normal">#</th>
              <Th>Address</Th>
              <Th>Direction</Th>
              <Th k="txCount" className="text-right">Transfers</Th>
              <Th k="totalVolume" className="text-right">Volume</Th>
              <Th>First</Th>
              <Th k="lastSeen">Latest</Th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((c, i) => (
              <tr
                key={c.address}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("a,button")) return;
                  router.push(`/wallet/${c.address}`);
                }}
                className="group cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-elevated"
              >
                <td className="px-3 py-3 pl-5 font-mono text-xs text-faint tabular">{i + 1}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <AddressLink address={c.address} />
                    <KindTag kind={c.kind} label={c.label} />
                  </div>
                </td>
                <td className="px-3 py-3">
                  <DirectionBadge d={c.dominant} />
                </td>
                <td className="px-3 py-3 text-right tabular text-ink-2">
                  {formatInt(c.txCount)}
                  {c.dominant === "both" && (
                    <span className="block text-[11px] text-faint">
                      {formatInt(c.inCount)} in · {formatInt(c.outCount)} out
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-right tabular text-ink">
                  {formatUsd(c.totalVolume)}
                  {c.dominant === "both" && (
                    <span className="block text-[11px] text-faint">
                      ↓{formatUsd(c.inVolume, { compact: true })} · ↑{formatUsd(c.outVolume, { compact: true })}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-muted">{formatDateTime(c.firstSeen)}</td>
                <td className="px-3 py-3 text-xs text-muted">{formatDateTime(c.lastSeen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-2 px-4 sm:hidden">
        {rows.slice(0, limit).map((c, i) => (
          <li key={c.address} className="rounded-lg border border-line bg-bg/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-faint">{i + 1}</span>
                <AddressLink address={c.address} />
              </div>
              <DirectionBadge d={c.dominant} />
            </div>
            <div className="mt-2 flex items-end justify-between">
              <div className="text-xs text-muted">
                {formatInt(c.txCount)} transfers
                <KindTag kind={c.kind} label={c.label} />
              </div>
              <span className="tabular text-sm text-ink">{formatUsd(c.totalVolume)}</span>
            </div>
          </li>
        ))}
      </ul>

      {rows.length > limit && (
        <div className="border-t border-line p-3 text-center sm:mt-0">
          <button type="button" onClick={() => setLimit((l) => l + 15)} className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-elevated hover:text-ink">
            Show more ({formatInt(rows.length - limit)} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
