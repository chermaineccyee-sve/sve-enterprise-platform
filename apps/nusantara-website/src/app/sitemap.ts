import type { MetadataRoute } from "next";
import { getAllInsights } from "@/content/insights";
import { LEGAL_PAGES } from "@/content/legal";
import { STRATEGIES } from "@/content/strategies";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const u = (p: string) => `${site.url}${p}`;
  const core = ["/", "/about", "/investment-approach", "/strategies", "/market-dashboard", "/insights", "/governance", "/contact"].map(
    (p) => ({ url: u(p), changeFrequency: (p === "/market-dashboard" ? "daily" : "monthly") as "daily" | "monthly", priority: p === "/" ? 1 : 0.8 }),
  );
  return [
    ...core,
    ...getAllInsights().map((i) => ({ url: u(`/insights/${i.slug}`), lastModified: i.date, changeFrequency: "yearly" as const, priority: 0.6 })),
    ...STRATEGIES.map((s) => ({ url: u(`/strategies/${s.slug}`), changeFrequency: "monthly" as const, priority: 0.5 })),
    ...LEGAL_PAGES.map((l) => ({ url: u(`/legal/${l.slug}`), changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
