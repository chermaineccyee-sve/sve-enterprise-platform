import { getMarketSnapshot } from "@/lib/market/service";

export const dynamic = "force-static";

export async function GET() {
  return Response.json(await getMarketSnapshot());
}
