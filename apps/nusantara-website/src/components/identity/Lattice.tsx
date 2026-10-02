/**
 * The Nusantara lattice — a secondary graphic language derived from the
 * logo's geometry (the logo itself is never altered): four interlocking arched
 * bands arranged as a pinwheel about a cross-axis, converging on a concave
 * four-point star. Coordinates are in a -100..100 box.
 */
import { useId } from "react";
import { STAR_PATH } from "./NStar";

/** Outer and inner edges of one arched band, pointing "up". */
/** Stems run past the centre so neighbouring arms weave across each other — the interlace. */
export const ARCH_OUTER = "M-14,34 L-14,-48 A22,22 0 0 1 30,-48 L30,34";
export const ARCH_INNER = "M-4,34 L-4,-48 A12,12 0 0 1 20,-48 L20,34";
export const ARM_ROTATIONS = [0, 90, 180, 270] as const;
/** Tip of each arm (top, right, bottom, left) — useful for labels. */
export const ARM_TIPS: [number, number][] = [
  [8, -70],
  [70, 8],
  [-8, 70],
  [-70, -8],
];

type LatticeProps = {
  className?: string;
  /** Stroke colour for bands (defaults to currentColor). Stroke width is in lattice units (box = 200). */
  stroke?: string;
  accent?: string;
  strokeWidth?: number;
  /** Highlight one arm (0 top, 1 right, 2 bottom, 3 left). */
  activeArm?: number | null;
  showAxes?: boolean;
  axisExtent?: number;
  showStar?: boolean;
  /** Draw-in animation via CSS (respects reduced motion). */
  draw?: boolean;
  title?: string;
};

export function Lattice({
  className = "",
  stroke = "currentColor",
  accent = "#cdae73",
  strokeWidth = 1,
  activeArm = null,
  showAxes = true,
  axisExtent = 100,
  showStar = true,
  draw = false,
  title,
}: LatticeProps) {
  const maskId = `lattice-${useId().replace(/:/g, "")}`;
  return (
    <svg
      viewBox="-100 -100 200 200"
      className={className}
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      overflow="visible"
    >
      {title && <title>{title}</title>}
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="-120" y="-120" width="240" height="240">
          <rect x="-120" y="-120" width="240" height="240" fill="#fff" />
          {showStar && <circle r="17" fill="#000" />}
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
      {showAxes && (
        <g stroke={stroke} strokeOpacity={0.35} strokeWidth={strokeWidth * 0.6} vectorEffect="non-scaling-stroke">
          <line x1={-axisExtent} y1="0" x2={axisExtent} y2="0" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1={-axisExtent} x2="0" y2={axisExtent} vectorEffect="non-scaling-stroke" />
        </g>
      )}
      {ARM_ROTATIONS.map((r, i) => {
        const on = activeArm === i;
        return (
          <g key={r} transform={`rotate(${r})`} style={{ transition: "opacity 500ms" }} opacity={activeArm === null || on ? 1 : 0.45}>
            {[ARCH_OUTER, ARCH_INNER].map((d) => (
              <path
                key={d}
                d={d}
                stroke={on ? accent : stroke}
                strokeWidth={strokeWidth}
                pathLength={1}
                className={draw ? "lattice-draw" : undefined}
                style={draw ? ({ animationDelay: `${i * 140}ms` } as React.CSSProperties) : undefined}
              />
            ))}
          </g>
        );
      })}
      </g>
      {showStar && <path d={STAR_PATH(11)} fill={accent} />}
    </svg>
  );
}
