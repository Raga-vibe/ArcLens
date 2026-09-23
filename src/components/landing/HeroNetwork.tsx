"use client";

import { useEffect, useRef } from "react";

// Decorative "observatory" field: address nodes, transfer paths, and
// particles moving along them. Canvas 2D, no dependencies. Pauses offscreen,
// renders a single still frame under prefers-reduced-motion.

interface Node {
  x: number;
  y: number;
  z: number; // depth 0.3–1, drives parallax + size
  r: number;
  hub: boolean;
  pulse: number;
}
interface Edge {
  a: number;
  b: number;
}
interface Particle {
  e: number;
  t: number;
  speed: number;
  dir: 1 | -1;
  warm: boolean;
}

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function HeroNetwork({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let nodes: Node[] = [];
    let edges: Edge[] = [];
    let particles: Particle[] = [];
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, active: false };
    let raf = 0;
    let visible = true;
    let last = performance.now();

    function build() {
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const r = rand(42);
      const count = Math.round(Math.min(90, Math.max(34, (w * h) / 16000)));
      nodes = [];
      for (let i = 0; i < count; i++) {
        const hub = r() < 0.09;
        // Bias toward the right/centre so copy on the left stays readable.
        const x = Math.pow(r(), 0.7) * 1.05;
        nodes.push({
          x: 0.05 + x * 0.95,
          y: 0.06 + r() * 0.88,
          z: 0.3 + r() * 0.7,
          r: hub ? 2.6 + r() * 1.6 : 0.9 + r() * 1.1,
          hub,
          pulse: r() * 10,
        });
      }
      edges = [];
      const maxD = 0.2;
      for (let i = 0; i < nodes.length; i++) {
        const near = nodes
          .map((n, j) => ({ j, d: Math.hypot((n.x - nodes[i].x) * (w / h), n.y - nodes[i].y) }))
          .filter((o) => o.j !== i && o.d < maxD)
          .sort((a, b) => a.d - b.d)
          .slice(0, nodes[i].hub ? 5 : 2);
        for (const o of near)
          if (!edges.some((e) => (e.a === o.j && e.b === i) || (e.a === i && e.b === o.j)))
            edges.push({ a: i, b: o.j });
      }
      particles = Array.from({ length: Math.min(40, Math.round(edges.length * 0.35)) }, () => spawn(r));
    }

    function spawn(r: () => number = Math.random): Particle {
      return {
        e: Math.floor(r() * edges.length),
        t: r(),
        speed: 0.08 + r() * 0.22,
        dir: r() < 0.5 ? 1 : -1,
        warm: r() < 0.3,
      };
    }

    function pos(n: Node) {
      const px = (mouse.x - 0.5) * 26 * n.z;
      const py = (mouse.y - 0.5) * 18 * n.z;
      return { x: n.x * w - px, y: n.y * h - py };
    }

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      ctx!.clearRect(0, 0, w, h);

      const P = nodes.map(pos);
      const mx = mouse.x * w;
      const my = mouse.y * h;

      // edges
      ctx!.lineWidth = 1;
      for (const e of edges) {
        const a = P[e.a];
        const b = P[e.b];
        const depth = (nodes[e.a].z + nodes[e.b].z) / 2;
        const near = mouse.active ? Math.max(0, 1 - Math.hypot((a.x + b.x) / 2 - mx, (a.y + b.y) / 2 - my) / 220) : 0;
        ctx!.strokeStyle = `rgba(169,196,240,${0.05 + depth * 0.07 + near * 0.22})`;
        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.stroke();
      }

      // particles
      for (const p of particles) {
        if (!reduce) p.t += p.speed * dt * p.dir;
        if (p.t > 1 || p.t < 0) Object.assign(p, spawn(), { t: p.dir === 1 ? 0 : 1 });
        const e = edges[p.e];
        if (!e) continue;
        const a = P[e.a];
        const b = P[e.b];
        const x = a.x + (b.x - a.x) * p.t;
        const y = a.y + (b.y - a.y) * p.t;
        const fade = Math.sin(Math.PI * p.t);
        ctx!.fillStyle = p.warm ? `rgba(227,163,63,${0.75 * fade})` : `rgba(210,225,250,${0.9 * fade})`;
        ctx!.beginPath();
        ctx!.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx!.fill();
      }

      // nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const p = P[i];
        const near = mouse.active ? Math.max(0, 1 - Math.hypot(p.x - mx, p.y - my) / 160) : 0;
        if (n.hub) {
          const phase = ((now / 1000 + n.pulse) % 4) / 4;
          if (!reduce) {
            ctx!.strokeStyle = `rgba(169,196,240,${0.35 * (1 - phase)})`;
            ctx!.beginPath();
            ctx!.arc(p.x, p.y, n.r + phase * 18, 0, Math.PI * 2);
            ctx!.stroke();
          }
          ctx!.fillStyle = "rgba(169,196,240,0.95)";
        } else {
          ctx!.fillStyle = `rgba(244,244,240,${0.25 + n.z * 0.35 + near * 0.4})`;
        }
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, n.r * (1 + near * 0.6), 0, Math.PI * 2);
        ctx!.fill();
      }

      if (!reduce && visible) raf = requestAnimationFrame(frame);
    }

    function start() {
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    build();
    start();

    const ro = new ResizeObserver(() => {
      build();
      if (reduce) start();
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && document.visibilityState === "visible";
      if (visible && !reduce) start();
    });
    io.observe(canvas);

    const onMove = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.tx = (ev.clientX - rect.left) / rect.width;
      mouse.ty = (ev.clientY - rect.top) / rect.height;
      mouse.active = mouse.ty >= 0 && mouse.ty <= 1;
    };
    const onLeave = () => {
      mouse.tx = 0.5;
      mouse.ty = 0.5;
      mouse.active = false;
    };
    const onVis = () => {
      visible = document.visibilityState === "visible";
      if (visible && !reduce) start();
    };
    if (!reduce) window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
