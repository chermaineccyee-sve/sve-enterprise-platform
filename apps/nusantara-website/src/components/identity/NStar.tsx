/**
 * The Nusantara four-point star — the concave cross at the centre of the logo,
 * abstracted. Used as the site-wide marker in place of bullets and diamonds.
 */
export function NStar({ className = "h-2 w-2", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="-10 -10 20 20" className={`shrink-0 ${className}`} aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <path d="M0,-10 Q1.6,-1.6 10,0 Q1.6,1.6 0,10 Q-1.6,1.6 -10,0 Q-1.6,-1.6 0,-10Z" fill="currentColor" />
    </svg>
  );
}

export const STAR_PATH = (s: number) => {
  const k = s * 0.16;
  return `M0,${-s} Q${k},${-k} ${s},0 Q${k},${k} 0,${s} Q${-k},${k} ${-s},0 Q${-k},${-k} 0,${-s}Z`;
};
