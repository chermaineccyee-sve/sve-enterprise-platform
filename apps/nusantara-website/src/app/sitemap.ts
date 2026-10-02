import type { MetadataRoute } from "next";
import { LEGAL_PAGES } from "@/content/legal";
import { getCapabilities, getInsights } from "@/lib/content/repository";
import { site } from "@/lib/site";

/** Lists only content the environment allows to be shown. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const u = (p: string) => `${site.url}${p}`;
  const [insights, capabilities] = await Promise.all([getInsights(), getCapabilities()]);
  const core = ["/", "/about", "/investment-approach", "/strategies", "/market-dashboard", "/insights", "/governance", "/contact"].map(
    (p) => ({ url: u(p), changeFrequency: (p === "/market-dashboard" ? "daily" : "monthly") as "daily" | "monthly", priority: p === "/" ? 1 : 0.8 }),
  );
  return [
    ...core,
    ...insights.map((i) => ({ url: u(`/insights/${i.slug}`), lastModified: i.updatedAt, changeFrequency: "yearly" as const, priority: 0.6 })),
    ...capabilities.map((s) => ({ url: u(`/strategies/${s.slug}`), changeFrequency: "monthly" as const, priority: 0.5 })),
    ...LEGAL_PAGES.map((l) => ({ url: u(`/legal/${l.slug}`), changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
