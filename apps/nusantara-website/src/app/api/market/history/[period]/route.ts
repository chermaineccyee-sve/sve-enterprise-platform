import { getMarketHistory } from "@/lib/market/service";
import { CHART_PERIODS, type ChartPeriod } from "@/lib/market/types";

export const dynamic = "force-static";
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
