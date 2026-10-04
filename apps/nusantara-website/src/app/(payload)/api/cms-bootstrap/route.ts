import config from "@payload-config";
import { getPayload } from "payload";
import { BOOTSTRAP_COOKIE, BOOTSTRAP_MAX_AGE, bootstrapConfigured, bootstrapCookieValue, tokenMatches } from "@/cms/bootstrap";
import { cmsOrigins } from "@/cms/env";
import { logEvent } from "@/cms/log";

/**
 * POST /api/cms-bootstrap — exchanges the bootstrap token for a short-lived
 * cookie that unlocks the create-first-user form, only while no account
 * exists (see src/cms/bootstrap.ts). Same-origin form posts only.
 */
export const dynamic = "force-dynamic";

const back = (state: "closed" | "invalid") => new Response(null, { status: 303, headers: { Location: `/admin/bootstrap?state=${state}`, "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const site = req.headers.get("sec-fetch-site");
  const origin = req.headers.get("origin");
  if (site ? site !== "same-origin" : !origin || !cmsOrigins().includes(origin)) {
    logEvent("warn", "auth.bootstrap.refused", { reason: "cross-site" });
    return new Response("Forbidden", { status: 403 });
  }
  if (!bootstrapConfigured()) return back("closed");

  const payload = await getPayload({ config });
  const { totalDocs } = await payload.count({ collection: "users", overrideAccess: true });
  if (totalDocs > 0) {
    logEvent("warn", "auth.bootstrap.refused", { reason: "accounts-exist" });
    return back("closed");
  }

  const form = await req.formData().catch(() => null);
  const candidate = String(form?.get("token") ?? "");
  if (!tokenMatches(candidate)) {
    logEvent("warn", "auth.bootstrap.refused", { reason: "wrong-token" });
    return back("invalid");
  }

  logEvent("info", "auth.bootstrap.unlocked", {});
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/admin/create-first-user",
      "Cache-Control": "no-store",
      "Set-Cookie": `${BOOTSTRAP_COOKIE}=${bootstrapCookieValue()}; Path=/; Max-Age=${BOOTSTRAP_MAX_AGE}; HttpOnly; SameSite=Strict${secure}`,
    },
  });
}
