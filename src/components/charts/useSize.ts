"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Observe an element's content width (for responsive SVG charts). Returns a
 * callback ref, so it keeps working if the observed element is swapped.
 */
export function useWidth<T extends HTMLElement>(initial = 640) {
  const [width, setWidth] = useState(initial);
  const ro = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    ro.current?.disconnect();
    if (!el) return;
    setWidth(Math.max(240, Math.floor(el.getBoundingClientRect().width)));
    ro.current = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.floor(e.contentRect.width))));
    ro.current.observe(el);
  }, []);
  return [ref, width] as const;
}
