import { blockText } from "@/content/insights";
import { getContentGraph, getInsights, getThemes } from "@/lib/content/repository";
import { getInstrument } from "@/lib/market/instruments";
import { buildSearchDoc, type SearchIndex } from "@/lib/search";

/** Static search index of visible research; rebuilt on deploy (or on CMS publish via revalidation). */
export const dynamic = "force-static";

export async function GET() {
  const [insights, graph, themes] = await Promise.all([getInsights(), getContentGraph(), getThemes()]);
  const themeTitle = new Map(themes.map((t) => [t.id, t.title]));
  const index: SearchIndex = {
    version: 1,
    generatedAt: new Date().toISOString(),
    docs: insights.map((i) =>
      buildSearchDoc(i.slug, {
        title: [i.title, i.subtitle],
        summary: [i.summary, ...i.executiveSummary, ...i.keyTakeaways],
        body: i.body.map(blockText),
        tags: [...i.tags, i.category],
        themes: graph.themesForInsight(i.slug).map((t) => themeTitle.get(t) ?? t),
        markets: graph.marketsForInsight(i.slug).flatMap((id) => {
          const inst = getInstrument(id);
          return inst ? [inst.name, inst.shortName, inst.market] : [];
        }),
        assetClasses: i.assetClasses ?? [],
      }),
    ),
  };
  return Response.json(index);
}
