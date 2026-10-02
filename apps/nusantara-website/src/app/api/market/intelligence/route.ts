import { getIntelligence } from "@/lib/market/service";

export const dynamic = "force-static";
/** Rebuilt at most every 60 s, so a delayed or live provider is re-read without a redeploy. */
export const revalidate = 60;

export async function GET() {
  return Response.json(await getIntelligence());
}
