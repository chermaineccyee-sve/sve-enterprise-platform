import { getMarketHistory } from "@/lib/market/service";
import { CHART_PERIODS, type ChartPeriod } from "@/lib/market/types";

export const dynamic = "force-static";
/** Rebuilt at most every 60 s, so a delayed or live provider is re-read without a redeploy. */
export const revalidate = 60;
export const dynamicParams = false;

export function generateStaticParams() {
  return CHART_PERIODS.map((period) => ({ period }));
}

export async function GET(_req: Request, ctx: RouteContext<"/api/market/history/[period]">) {
  const { period } = await ctx.params;
  if (!CHART_PERIODS.includes(period as ChartPeriod)) {
    return Response.json({ error: "Unknown period" }, { status: 404 });
  }
  return Response.json(await getMarketHistory(period as ChartPeriod));
}
