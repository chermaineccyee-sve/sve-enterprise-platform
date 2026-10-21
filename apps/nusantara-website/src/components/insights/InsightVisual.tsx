import type { Insight } from "@/content/insights/types";

function seeded(slug: string) {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) h = Math.imul(h ^ slug.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
}

/**
 * Abstract, data-derived hero artwork generated from the article slug.
 * Typographic and diagrammatic rather than photographic, by design.
 */
export function InsightVisual({
  insight,
  className = "",
  tone = "dark",
}: {
  insight: Pick<Insight, "slug" | "hero">;
  className?: string;
  tone?: "dark" | "light";
}) {
  const r = seeded(insight.slug);
  // Round every coordinate so server and browser markup match exactly.
  const q = (v: number) => Math.round(v * 10) / 10;
  const W = 800;
  const H = 500;
  const dark = tone === "dark";
  const bg = dark ? "#0e2d3b" : "#efe8da";
  const line = dark ? "rgba(196,213,219,0.38)" : "rgba(18,56,74,0.28)";
  const gold = dark ? "#cdae73" : "#9a7838";
  const motif = insight.hero.motif;

  let content: React.ReactNode = null;
  if (motif === "arcs") {
    // Contour lines: a quiet, data-like landscape.
    const phase = r() * 6;
    content = (
      <>
        {Array.from({ length: 14 }, (_, k) => {
          const base = 70 + k * 28;
          const pts: string[] = [];
          for (let x = 0; x <= W; x += 20) pts.push(`${x},${q(base + Math.sin(x / 140 + phase + k * 0.35) * (18 + k * 1.5))}`);
          return <polyline key={k} points={pts.join(" ")} fill="none" stroke={k === 6 ? gold : line} strokeWidth={k === 6 ? 1.6 : 1} />;
        })}
      </>
    );
  } else if (motif === "lines") {
    const series = Array.from({ length: 5 }, (_, k) => {
      let y = 260 + (r() - 0.5) * 120;
      const pts: string[] = [];
      for (let x = 0; x <= W; x += 20) {
        y += (r() - 0.5) * 26 - (k === 2 ? 1.2 : 0);
        pts.push(`${x},${q(Math.max(40, Math.min(H - 40, y)))}`);
      }
      return pts.join(" ");
    });
    content = (
      <>
        {[100, 200, 300, 400].map((y) => (
          <line key={y} x1="0" x2={W} y1={y} y2={y} stroke={line} strokeOpacity={0.5} />
        ))}
        {series.map((p, i) => (
          <polyline key={i} points={p} fill="none" stroke={i === 2 ? gold : line} strokeWidth={i === 2 ? 2 : 1.1} />
        ))}
      </>
    );
  } else if (motif === "grid") {
    const cells: React.ReactNode[] = [];
    for (let x = 40; x < W; x += 40)
      for (let y = 40; y < H; y += 40) {
        const v = r();
        cells.push(
          v > 0.93 ? (
            <rect key={`${x}-${y}`} x={x - 6} y={y - 6} width={12} height={12} fill={gold} />
          ) : (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={v > 0.6 ? 2 : 1.2} fill={line} />
          ),
        );
      }
    content = <>{cells}</>;
  } else if (motif === "bars") {
    content = (
      <>
        {Array.from({ length: 38 }, (_, i) => {
          const h = q(60 + r() * 260 + Math.sin(i / 5) * 40);
          const x = 30 + i * 20;
          return <rect key={i} x={x} y={q(H - 60 - h)} width={6} height={h} fill={i % 9 === 4 ? gold : line} />;
        })}
        <line x1="0" x2={W} y1={H - 60} y2={H - 60} stroke={line} />
      </>
    );
  } else {
    // Interlaced governance frames.
    content = (
      <>
        {Array.from({ length: 7 }, (_, i) => {
          const h = 230 - i * 30;
          return <rect key={i} x={400 - h} y={250 - h} width={h * 2} height={h * 2} rx={h * 0.22} fill="none" stroke={i === 2 ? gold : line} strokeWidth={i === 2 ? 1.6 : 1} />;
        })}
        <path d={`M400,232 Q403,247 418,250 Q403,253 400,268 Q397,253 382,250 Q397,247 400,232Z`} fill={gold} />
      </>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={`block h-full w-full ${className}`}
      aria-hidden
      focusable="false"
    >
      <rect width={W} height={H} fill={bg} />
      {content}
    </svg>
  );
}
