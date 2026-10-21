import { linePath } from "./chart-utils";

type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  /** Draw the series' starting level as a hairline reference. */
  baseline?: boolean;
  area?: boolean;
  className?: string;
  label: string;
  animate?: boolean;
};

/** Compact trend line. Decorative-plus: always paired with a numeric value and an aria label. */
export function Sparkline({
  values,
  width = 120,
  height = 36,
  color = "currentColor",
  baseline = true,
  area = true,
  className = "",
  label,
  animate = false,
}: SparklineProps) {
  if (values.length < 2) return null;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const xs = values.map((_, i) => r2(pad + (i / (values.length - 1)) * (width - pad * 2)));
  const ys = values.map((v) => r2(pad + (1 - (v - min) / span) * (height - pad * 2)));
  const d = linePath(xs, ys);
  const by = r2(pad + (1 - (values[0] - min) / span) * (height - pad * 2));
  const lastX = xs[xs.length - 1];
  const lastY = ys[ys.length - 1];

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={`overflow-visible ${className}`}
    >
      {baseline && <line x1={pad} x2={width - pad} y1={by} y2={by} stroke="currentColor" strokeOpacity={0.18} strokeWidth={1} />}
      {area && (
        <path d={`${d}L${lastX.toFixed(2)},${height}L${xs[0].toFixed(2)},${height}Z`} fill={color} fillOpacity={0.08} />
      )}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1000}
        className={animate ? "chart-draw" : undefined}
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} stroke="var(--color-paper)" strokeWidth={1.5} />
    </svg>
  );
}
