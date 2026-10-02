import Image from "next/image";
import Link from "next/link";
import legacyLogo from "../../../public/brand/nusantara-logo.png";

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

type LogoProps = {
  /** Rendered height in px. Width follows the supplied logo's proportions. */
  height?: number;
  /**
   * Previous logo asset, still used in the footer until a light (dark-ground)
   * version of the master logo is supplied — a pending brand asset.
   */
  surface?: "light" | "dark";
  href?: string | null;
  priority?: boolean;
  className?: string;
};

export function Logo({ height = 56, surface = "light", href = "/", priority, className = "" }: LogoProps) {
  const width = Math.round((height * legacyLogo.width) / legacyLogo.height);
  const img = (
    <Image
      src={legacyLogo}
      alt="Nusantara Fund Management"
      width={width}
      height={height}
      priority={priority}
      sizes={`${width}px`}
      className={surface === "light" ? "mix-blend-multiply" : ""}
      style={{ width, height }}
    />
  );
  const body =
    surface === "dark" ? (
      <span className="inline-flex bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]" style={{ padding: height * 0.16 }}>
        {img}
      </span>
    ) : (
      img
    );
  if (!href) return <span className={`inline-flex ${className}`}>{body}</span>;
  return (
    <Link href={href} className={`inline-flex shrink-0 ${className}`} aria-label="Nusantara Fund Management — home">
      {body}
    </Link>
  );
}
