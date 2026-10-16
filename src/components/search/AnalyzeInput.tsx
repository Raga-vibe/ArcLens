"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { EXAMPLE_ADDRESS } from "@/lib/site";
import { classifyInput, MAX_INPUT_LENGTH } from "@/lib/validate";
import { NETWORK_OPTIONS, type NetworkKey } from "@/lib/networks";

interface Props {
  size?: "hero" | "compact";
  autoFocus?: boolean;
  showExample?: boolean;
  defaultNetwork?: NetworkKey;
}

export function AnalyzeInput({ size = "hero", autoFocus, showExample, defaultNetwork = "arc-mainnet" }: Props) {
  const router = useRouter();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [network, setNetwork] = useState<NetworkKey>(defaultNetwork);
  const [prevDefaultNetwork, setPrevDefaultNetwork] = useState(defaultNetwork);

  if (defaultNetwork !== prevDefaultNetwork) {
    setPrevDefaultNetwork(defaultNetwork);
    setNetwork(defaultNetwork);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const kind = useMemo(() => classifyInput(value), [value]);
  const hero = size === "hero";

  function go(target: string) {
    const k = classifyInput(target);
    if (k.kind === "empty") {
      setError("Paste a wallet address or transaction hash to begin.");
      return;
    }
    if (k.kind === "invalid") {
      setError(k.reason);
      return;
    }
    setError(null);
    startTransition(() => {
      router.push(`${k.kind === "address" ? `/wallet/${k.value}` : `/tx/${k.value}`}?network=${network}`);
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
        aria-label="Analyze an address or transaction"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          go(value);
        }}
        className={`group relative flex w-full items-center gap-2 rounded-[14px] border bg-surface/85 backdrop-blur-md shadow-xs transition-[border-color,box-shadow] duration-300 ${
          error
            ? "border-bad/60 shadow-[0_0_20px_-4px_rgba(224,98,90,0.15)]"
            : "border-line-strong hover:border-line-strong focus-within:border-accent/80 focus-within:shadow-[0_0_24px_-4px_rgba(169,196,240,0.18),0_0_0_1px_rgba(169,196,240,0.3)]"
        } ${hero ? "flex-wrap p-2 pl-4 sm:flex-nowrap sm:pl-5" : "p-1 pl-3"}`}
      >
        <label htmlFor={id} className="sr-only">
          Wallet address or transaction hash
        </label>
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`shrink-0 text-muted transition-colors group-focus-within:text-accent ${hero ? "size-5" : "size-4"}`} fill="none">
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="m13.5 13.5 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
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
          placeholder={hero ? "Paste a wallet address…" : "Search address or tx hash…"}
          aria-invalid={!!error}
          aria-describedby={`${id}-msg`}
          className={`min-w-0 flex-1 bg-transparent font-mono text-ink placeholder:font-sans placeholder:text-faint focus:outline-none ${
            hero ? "h-12 text-[15px] sm:text-base" : "h-9 text-[13px]"
          }`}
        />
        {!value && (
          <kbd
            className={`pointer-events-none rounded border border-line bg-surface/80 font-mono text-muted shadow-xs transition-opacity ${
              hero
                ? "hidden md:inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px]"
                : "hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px]"
            }`}
            title="Press Cmd+K or / to search"
          >
            <span className={hero ? "text-xs" : "text-[10px]"}>⌘</span>K
          </kbd>
        )}
        {hero && (
          <label className="flex shrink-0 items-center gap-2 rounded-lg border border-line bg-surface/90 px-2.5 text-xs text-muted shadow-xs transition-colors hover:border-line-strong">
            <span
              className={`size-1.5 rounded-full ${
                network === "arc-mainnet" ? "bg-good" : "bg-accent"
              }`}
              aria-hidden="true"
            />
            <span className="sr-only">Network</span>
            <select
              aria-label="Network"
              value={network}
              onChange={(event) => setNetwork(event.target.value as NetworkKey)}
              className="h-9 max-w-[170px] bg-transparent font-medium text-ink outline-none cursor-pointer"
            >
              {NETWORK_OPTIONS.map((option) => (
                <option key={option.key} value={option.key} className="bg-surface text-ink">
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {hint && hero && (
          <span className="hidden shrink-0 rounded-full border border-line px-2.5 py-1 text-[11px] text-muted sm:inline">
            {hint}
          </span>
        )}
        <button
          type="submit"
          disabled={pending}
          className={`relative shrink-0 overflow-hidden rounded-[10px] bg-ink font-medium text-bg transition-[transform,background-color] duration-200 hover:bg-white active:scale-[0.98] disabled:opacity-70 ${
            hero ? "h-12 w-full px-5 text-[15px] sm:w-auto" : "h-9 px-3 text-[13px]"
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
