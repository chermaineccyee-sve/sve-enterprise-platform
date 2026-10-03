/**
 * The persistent visual for the investment story. Built from the Nusantara
 * lattice; each stage adds a layer and nothing earlier is removed, so by
 * stage 06 the drawing is the complete system:
 *
 *  0 Market insight       — market signals along the four axes
 *  1 Opportunity curation — a curation frame; shortlisted signals turn gold and connect, the rest dim
 *  2 Investment review    — the lattice bands resolve; a review sweep, then review marks on each arm
 *  3 Risk & governance    — interlaced governance frames enclose the system, with gates on the axes
 *  4 Allocation           — the star fills; arm tips take measured positions
 *  5 Monitoring           — an orbit with review ticks and a travelling marker closes the system
 */
import { ARCH_INNER, ARCH_OUTER, ARM_ROTATIONS } from "./Lattice";
import { STAR_PATH } from "./NStar";

// Deterministic signal field (no randomness at render time).
const SIGNALS: { x: number; y: number; keep: boolean }[] = [
  [-88, -20, false], [-70, 34, true], [-52, -62, true], [-30, 84, false], [-12, -90, false],
  [18, 70, true], [36, -78, false], [58, 46, true], [82, -36, false], [92, 22, false],
  [-60, -8, true], [40, 18, true], [-24, -40, true], [10, 44, true], [70, -66, false], [-84, 70, false],
].map(([x, y, keep]) => ({ x: x as number, y: y as number, keep: keep as boolean }));

// Connections drawn between the shortlisted signals, in a fixed order.
const LINKS = SIGNALS.filter((p) => p.keep)
  .sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x))
  .map((p) => `${p.x},${p.y}`)
  .join(" ");

const fade = (on: boolean, o = 1) => ({ opacity: on ? o : 0, transition: "opacity 700ms cubic-bezier(0.22,1,0.36,1), transform 900ms cubic-bezier(0.22,1,0.36,1)" });

export function AllocationSystem({ stage, className = "" }: { stage: number; className?: string }) {
  const s = stage;
  return (
    <svg viewBox="-120 -120 240 240" className={className} fill="none" role="img" aria-label={`Allocation system, stage ${s + 1} of 6`}>
      {/* axes */}
      <g stroke="rgba(196,213,219,0.25)" strokeWidth="0.5">
        <line x1="-118" y1="0" x2="118" y2="0" />
        <line x1="0" y1="-118" x2="0" y2="118" />
      </g>

      {/* 0 — signals */}
      <g>
        {SIGNALS.map((p, i) => {
          const o = s === 0 ? (p.keep ? 0.95 : 0.6) : p.keep ? (s >= 4 ? 0.55 : 0.95) : 0.14;
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={s === 0 ? 2.2 : 2.6}
              fill={p.keep && s >= 1 ? "#cdae73" : "#c4d5db"}
              className="drift"
              style={{ ...fade(true, o), ["--dx" as string]: `${(i % 3) - 1}px`, ["--dy" as string]: `${(i % 2 ? -1 : 1) * 2}px`, ["--drift-d" as string]: `${5 + (i % 4)}s` }}
            />
          );
        })}
      </g>

      {/* 1 — shortlisted signals connect */}
      <polygon points={LINKS} stroke="#cdae73" strokeWidth="0.5" style={fade(s >= 1, s >= 4 ? 0.3 : 0.55)} />

      {/* 1 — curation frame (stays, quieter once the governance frames arrive) */}
      <rect x="-78" y="-78" width="156" height="156" transform="rotate(45)" stroke="#cdae73" strokeWidth="0.8" strokeDasharray="3 4" style={fade(s >= 1, s >= 3 ? 0.35 : 0.8)} />

      {/* 2 — lattice bands resolve */}
      <g style={fade(true)}>
        {ARM_ROTATIONS.map((r) => (
          <g key={r} transform={`rotate(${r})`}>
            <path d={ARCH_OUTER} stroke="#e3ecef" strokeWidth="1" style={fade(true, s >= 2 ? 0.95 : 0.18)} />
            <path d={ARCH_INNER} stroke="#e3ecef" strokeWidth="1" style={fade(true, s >= 2 ? 0.95 : 0.18)} />
          </g>
        ))}
      </g>
      {/* review marks: one per arm, kept after the review */}
      <g style={fade(s >= 2, 0.9)}>
        {[0, 90, 180, 270].map((r) => (
          <line key={r} x1="-4" y1="-50" x2="4" y2="-50" stroke="#cdae73" strokeWidth="1" transform={`rotate(${r + 45})`} />
        ))}
      </g>
      {/* review sweep */}
      <g style={fade(s === 2, 1)}>
        <g className="spin-origin">
          <path d="M0,0 L0,-104 A104,104 0 0 1 52,-90 Z" fill="url(#sweep)" />
        </g>
      </g>
      <defs>
        <radialGradient id="sweep" cx="0" cy="0" r="104" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#cdae73" stopOpacity="0" />
          <stop offset="1" stopColor="#cdae73" stopOpacity="0.28" />
        </radialGradient>
      </defs>

      {/* 3 — governance frames (interlaced squares) */}
      <g style={fade(s >= 3)}>
        <rect x="-96" y="-96" width="192" height="192" stroke="#cdae73" strokeWidth="1" />
        <rect x="-96" y="-96" width="192" height="192" transform="rotate(45)" stroke="#cdae73" strokeWidth="0.6" strokeOpacity="0.6" />
        {/* gates where the frame meets the axes */}
        {[0, 90, 180, 270].map((r) => (
          <g key={r} transform={`rotate(${r})`}>
            <line x1="-5" y1="-92" x2="-5" y2="-100" stroke="#cdae73" strokeWidth="1" />
            <line x1="5" y1="-92" x2="5" y2="-100" stroke="#cdae73" strokeWidth="1" />
          </g>
        ))}
      </g>

      {/* 4 — allocation: measured positions at arm tips */}
      <g style={fade(s >= 4)}>
        {[
          [8, -72, 7],
          [72, 8, 5],
          [-8, 72, 6],
          [-72, -8, 4],
        ].map(([x, y, r], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={r} fill="#cdae73" />
            <circle cx={x} cy={y} r={(r as number) + 4} stroke="#cdae73" strokeOpacity="0.4" />
          </g>
        ))}
      </g>

      {/* 5 — monitoring orbit */}
      <g style={fade(s >= 5)}>
        <circle r="110" stroke="rgba(196,213,219,0.45)" strokeWidth="0.6" strokeDasharray="1 5" />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1="0" y1="-106" x2="0" y2="-114" stroke="#cdae73" strokeWidth="0.8" transform={`rotate(${i * 30})`} />
        ))}
        <g className="spin-origin" style={{ animationDuration: "24s" }}>
          <circle cx="0" cy="-110" r="3.5" fill="#cdae73" />
        </g>
      </g>

      {/* centre */}
      <circle r="17" fill="#0e2d3b" />
      <path d={STAR_PATH(11)} fill={s >= 4 ? "#cdae73" : "none"} stroke="#cdae73" strokeWidth="1" style={{ transition: "fill 600ms" }} />
    </svg>
  );
}
