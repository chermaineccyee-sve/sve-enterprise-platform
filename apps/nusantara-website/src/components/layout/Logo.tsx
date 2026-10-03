import Link from "next/link";

/**
 * MASTER LOGO — "Nusantara Logo (Transparent)", stored unaltered in
 * brand-source/. The web renditions in public/brand/nusantara-logo-h{66,84}@{1,2,3}x.png
 * are derived from it by brand-source/derive-renditions.mjs: fully transparent margin removed,
 * resized (Lanczos), saved as lossless PNG with transparency. The artwork
 * itself is never recoloured, redrawn or cropped.
 */
const MASTER_ASPECT = 1310 / 1179;
const renditions = (h: number) =>
  [1, 2, 3].map((d) => `/brand/nusantara-logo-h${h}@${d}x.png ${Math.round(MASTER_ASPECT * h * d)}w`).join(", ");

/** Header logo: 66px tall on mobile, 84px from md, aspect ratio preserved. */
export function MasterLogo({ href = "/", className = "" }: { href?: string | null; className?: string }) {
  const w66 = Math.round(MASTER_ASPECT * 66);
  const w84 = Math.round(MASTER_ASPECT * 84);
  const img = (
    // A plain <img> with explicit renditions keeps the logo lossless (no re-encoding by the image optimiser).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/nusantara-logo-h84@2x.png"
      srcSet={`${renditions(66)}, ${renditions(84)}`}
      sizes={`(min-width: 768px) ${w84}px, ${w66}px`}
      width={w84}
      height={84}
      alt="Nusantara Fund Management"
      decoding="async"
      fetchPriority="high"
      className="block h-[66px] w-auto md:h-[84px]"
      style={{ aspectRatio: `${MASTER_ASPECT}` }}
    />
  );
  if (!href) return <span className={`inline-flex ${className}`}>{img}</span>;
  return (
    <Link href={href} className={`inline-flex shrink-0 ${className}`} aria-label="Nusantara Fund Management — home">
      {img}
    </Link>
  );
}

/**
 * Footer logo on the dark teal ground: the master logo with its wordmark given a
 * light fill (brand-source/derive-footer-renditions.mjs). Emblem and gold full
 * stop unchanged; transparent background, so no plate. 116px tall (≈129px wide).
 */
export function FooterLogo({ href = "/", className = "" }: { href?: string | null; className?: string }) {
  const h = 116;
  const w = Math.round(MASTER_ASPECT * h);
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand/nusantara-logo-footer-h${h}@2x.png`}
      srcSet={[1, 2, 3].map((d) => `/brand/nusantara-logo-footer-h${h}@${d}x.png ${d}x`).join(", ")}
      width={w}
      height={h}
      alt="Nusantara Fund Management"
      loading="lazy"
      decoding="async"
      className="block h-[116px] w-auto"
      style={{ aspectRatio: `${MASTER_ASPECT}` }}
    />
  );
  // Block-level, so the tagline spacing below is exact (no inline line-box gap).
  if (!href) return <span className={`flex w-fit ${className}`}>{img}</span>;
  return (
    <Link href={href} className={`flex w-fit shrink-0 ${className}`} aria-label="Nusantara Fund Management — home">
      {img}
    </Link>
  );
}
