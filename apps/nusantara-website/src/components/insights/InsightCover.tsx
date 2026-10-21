import { InsightVisual } from "@/components/insights/InsightVisual";
import { MorphChart } from "@/components/market/MorphChart";
import type { InsightCoverImage, InsightListing } from "@/content/insights/types";

/**
 * The cover visual chosen for an Insight in the Admin Portal. It fills the
 * existing visual frame of each card or header, which keeps its own size:
 *  - image:    the editorial image, cropped with object-fit around its focal point;
 *  - research: the article's lead chart (card variant only — articles show their charts in the body);
 *  - default:  the Nusantara abstract visual (InsightVisual).
 */
export function InsightCover({
  insight,
  variant = "card",
  sizes = "(min-width: 768px) 340px, 72vw",
  className = "",
}: {
  insight: Pick<InsightListing, "slug" | "hero" | "cover" | "coverChart">;
  variant?: "card" | "hero";
  sizes?: string;
  className?: string;
}) {
  const cover = insight.cover;
  if (cover?.type === "image") return <CoverImage image={cover.image} sizes={sizes} eager={variant === "hero"} className={className} />;
  if (cover?.type === "research" && variant === "card" && insight.coverChart) {
    const c = insight.coverChart;
    const fmt = (v: number) => `${new Intl.NumberFormat("en-GB", { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals }).format(v)}${c.unit ?? ""}`;
    return (
      // Decorative in a card (the card itself is the link); the article carries the interactive chart.
      <div className={`flex h-full w-full items-center bg-[#0e2d3b] px-3 ${className}`} aria-hidden inert>
        <div className="w-full">
          <MorphChart
            series={c.series.map((s, i) => ({ ...s, color: i === 0 ? "#cdae73" : "#9db6c0" }))}
            labels={c.xLabels}
            format={fmt}
            height={190}
            tone="dark"
            area={c.series.length === 1}
            ariaLabel={c.caption}
          />
        </div>
      </div>
    );
  }
  return <InsightVisual insight={insight} className={className} />;
}

export function CoverImage({ image, sizes, eager = false, className = "" }: { image: InsightCoverImage; sizes: string; eager?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- CMS media is served by the Admin Portal's access-controlled route, with its own responsive sizes
    <img
      src={image.url}
      srcSet={image.srcSet}
      sizes={image.srcSet ? sizes : undefined}
      alt={image.alt}
      width={image.width}
      height={image.height}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={`block h-full w-full object-cover ${className}`}
      style={{ objectPosition: `${image.focalX ?? 50}% ${image.focalY ?? 50}%` }}
    />
  );
}
