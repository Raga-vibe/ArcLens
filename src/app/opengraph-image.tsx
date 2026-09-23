import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "ArcLens: See what’s happening on Arc.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Deterministic "observatory" constellation for the preview.
function field() {
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const nodes = Array.from({ length: 46 }, () => ({ x: 560 + r() * 620, y: 40 + r() * 550, hub: r() < 0.12 }));
  const edges: [number, number][] = [];
  nodes.forEach((a, i) => {
    nodes
      .map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.y - b.y) }))
      .filter((o) => o.j !== i && o.d < 150)
      .sort((p, q) => p.d - q.d)
      .slice(0, a.hub ? 4 : 2)
      .forEach((o) => edges.push([i, o.j]));
  });
  return { nodes, edges };
}

export default async function Image() {
  const dir = join(process.cwd(), "src/assets/fonts");
  const [serif, serifItalic, mono] = await Promise.all([
    readFile(join(dir, "instrument-serif-latin-400-normal.woff")),
    readFile(join(dir, "instrument-serif-latin-400-italic.woff")),
    readFile(join(dir, "geist-mono-latin-400-normal.woff")),
  ]);
  const { nodes, edges } = field();

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#08090b", position: "relative", fontFamily: "Serif" }}>
        <svg width="1200" height="630" style={{ position: "absolute", inset: 0 }}>
          {edges.map(([a, b], i) => (
            <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke="rgba(169,196,240,0.16)" strokeWidth="1" />
          ))}
          {nodes.map((n, i) =>
            n.hub ? (
              <g key={i}>
                <circle cx={n.x} cy={n.y} r="14" fill="none" stroke="rgba(169,196,240,0.25)" />
                <circle cx={n.x} cy={n.y} r="4.5" fill="#a9c4f0" />
              </g>
            ) : (
              <circle key={i} cx={n.x} cy={n.y} r="2" fill="rgba(244,244,240,0.55)" />
            ),
          )}
          <rect x="0" y="0" width="760" height="630" fill="url(#fade)" />
          <defs>
            <linearGradient id="fade" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0.55" stopColor="#08090b" stopOpacity="1" />
              <stop offset="1" stopColor="#08090b" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px 80px", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="44" height="44" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="12.5" stroke="#f4f4f0" strokeWidth="2.2" fill="none" />
              <path d="M5.5 21.5C9 13 23 13 26.5 21.5" stroke="#a9c4f0" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              <circle cx="16" cy="15" r="3" fill="#a9c4f0" />
            </svg>
            <div style={{ display: "flex", fontFamily: "Mono", fontSize: 26, letterSpacing: 7, color: "#f4f4f0" }}>
              ARC<span style={{ color: "#a9c4f0" }}>LENS</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 104, lineHeight: 0.95, color: "#f4f4f0", letterSpacing: -2 }}>See what’s happening</div>
            <div style={{ fontSize: 104, lineHeight: 1.05, color: "#a9c4f0", fontStyle: "italic", letterSpacing: -2 }}>on Arc.</div>
          </div>
          <div style={{ display: "flex", fontFamily: "Mono", fontSize: 20, color: "#8e949f", letterSpacing: 3 }}>
            ON-CHAIN INTELLIGENCE · ARC MAINNET · USDC
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Serif", data: serif, style: "normal", weight: 400 },
        { name: "Serif", data: serifItalic, style: "italic", weight: 400 },
        { name: "Mono", data: mono, style: "normal", weight: 400 },
      ],
    },
  );
}
