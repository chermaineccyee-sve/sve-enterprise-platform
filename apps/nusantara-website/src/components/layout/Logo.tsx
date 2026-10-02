import Image from "next/image";
import Link from "next/link";
import logo from "../../../public/brand/nusantara-logo.png";

type LogoProps = {
  /** Rendered height in px. Width follows the supplied logo's proportions. */
  height?: number;
  /**
   * On light surfaces the supplied logo's white ground is blended into the
   * page (multiply) — the artwork itself is untouched. On dark surfaces the
   * logo sits on its original white plate with clear space, as in the
   * existing Nusantara materials, rather than being recoloured.
   */
  surface?: "light" | "dark";
  href?: string | null;
  priority?: boolean;
  className?: string;
};

export function Logo({ height = 56, surface = "light", href = "/", priority, className = "" }: LogoProps) {
  const width = Math.round((height * logo.width) / logo.height);
  const img = (
    <Image
      src={logo}
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
