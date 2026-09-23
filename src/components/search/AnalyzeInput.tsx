"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { EXAMPLE_ADDRESS } from "@/lib/site";
import { classifyInput, MAX_INPUT_LENGTH } from "@/lib/validate";

interface Props {
  size?: "hero" | "compact";
  autoFocus?: boolean;
  showExample?: boolean;
}

export function AnalyzeInput({ size = "hero", autoFocus, showExample }: Props) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const kind = useMemo(() => classifyInput(value), [value]);
  const hero = size === "hero";

  function go(target: string) {
    const k = classifyInput(target);
    if (k.kind === "empty") {
      setError("Paste an Arc wallet address or transaction hash to begin.");
      return;
    }
    if (k.kind === "invalid") {
      setError(k.reason);
      return;
    }
    setError(null);
    startTransition(() => {
      router.push(k.kind === "address" ? `/wallet/${k.value}` : `/tx/${k.value}`);
    });
  }

  const hint =
    kind.kind === "address"
      ? "Wallet address"
      : kind.kind === "tx"
        ? "Transaction hash"
        : null;

  const cta = kind.kind === "tx" ? "Analyze transaction" : "Analyze wallet";

  return (
    <div className="w-full">
      <form
        role="search"
        aria-label="Analyze an Arc address or transaction"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          go(value);
        }}
        className={`group relative flex w-full items-center gap-2 rounded-[14px] border bg-surface/90 backdrop-blur transition-[border-color,box-shadow] duration-300 ${
          error ? "border-bad/60" : "border-line-strong focus-within:border-accent/60"
        } focus-within:shadow-[0_0_0_4px_rgba(169,196,240,0.08)] ${hero ? "p-2 pl-5" : "p-1 pl-3"}`}
      >
        <label htmlFor={id} className="sr-only">
          Arc wallet address or transaction hash
        </label>
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`shrink-0 text-muted ${hero ? "size-5" : "size-4"}`} fill="none">
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="m13.5 13.5 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          id={id}
          value={value}
          onChange={(e) => {
            setValue(e.target.value.slice(0, MAX_INPUT_LENGTH + 20));
            if (error) setError(null);
          }}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="text"
          placeholder={hero ? "Paste an Arc wallet address…" : "Search address or tx hash…"}
          aria-invalid={!!error}
          aria-describedby={`${id}-msg`}
          className={`min-w-0 flex-1 bg-transparent font-mono text-ink placeholder:font-sans placeholder:text-faint focus:outline-none ${
            hero ? "h-12 text-[15px] sm:text-base" : "h-9 text-[13px]"
          }`}
        />
        {hint && hero && (
          <span className="hidden shrink-0 rounded-full border border-line px-2.5 py-1 text-[11px] text-muted sm:inline">
            {hint}
          </span>
        )}
        <button
          type="submit"
          disabled={pending}
          className={`relative shrink-0 overflow-hidden rounded-[10px] bg-ink font-medium text-bg transition-[transform,background-color] duration-200 hover:bg-white active:scale-[0.98] disabled:opacity-70 ${
            hero ? "h-12 px-5 text-[15px]" : "h-9 px-3 text-[13px]"
          }`}
        >
          <span className={pending ? "opacity-0" : ""}>{hero ? cta : "Analyze"}</span>
          {pending && (
            <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
              <span className="size-4 animate-spin rounded-full border-2 border-bg/30 border-t-bg" />
            </span>
          )}
          <span className="sr-only" aria-live="polite">{pending ? "Loading" : ""}</span>
        </button>
      </form>
      <div id={`${id}-msg`} aria-live="polite" className={hero ? "mt-3 min-h-5 text-sm" : "sr-only"}>
        {error ? (
          <p className="flex items-center gap-2 text-bad">
            <span aria-hidden="true">⚠</span> {error}
          </p>
        ) : hero && showExample ? (
          <p className="text-muted">
            Also accepts a transaction hash.{" "}
            <button
              type="button"
              onClick={() => {
                setValue(EXAMPLE_ADDRESS);
                go(EXAMPLE_ADDRESS);
              }}
              className="text-ink-2 underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
            >
              Try an example
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
