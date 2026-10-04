import { cookies, draftMode } from "next/headers";
import { PREVIEW_COOKIE } from "@/lib/content/preview-session";

/** Leaves preview: Draft Mode off, preview cookie removed, back to the live page. */
export const dynamic = "force-dynamic";

async function exit(request: Request) {
  (await draftMode()).disable();
  (await cookies()).delete(PREVIEW_COOKIE);
  const back = new URL(request.url).searchParams.get("path") ?? "/";
  // Same-site paths only.
  const path = back.startsWith("/") && !back.startsWith("//") ? back : "/";
  return new Response(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store" } });
}

export const POST = exit;
export const GET = exit;
