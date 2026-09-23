import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { verifySessionCookie } from "./_auth-core.mts";
import { upsertEventLink } from "./_calendar-model.mts";

/** The ONLY endpoint that ever sets clientId/matterId/workstream on a
 * calendar event, and only because the user explicitly called it — no
 * automatic classification exists anywhere in this codebase. action:
 * "unlink" clears the relationship back to unlinked rather than deleting
 * the row, so a later "Link to Matter" on the same event is just an
 * update, not a fresh insert. */
export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const sessionSecret = Netlify.env.get("EXECUTIVE_VAULT_SESSION_SECRET");
  if (!sessionSecret) return Response.json({ error: "Authentication is not configured." }, { status: 503 });
  const session = await verifySessionCookie(req.headers.get("cookie"), sessionSecret);
  if (!session) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { provider, providerEventId, calendarId, clientId, matterId, workstream, action } = body || {};
  if (provider !== "google" || !providerEventId || !calendarId) {
    return Response.json({ error: "provider, providerEventId and calendarId are required." }, { status: 400 });
  }
  const isUnlink = action === "unlink";
  if (!isUnlink && !clientId) {
    return Response.json({ error: "clientId is required to link an event." }, { status: 400 });
  }

  const db = getDatabase();
  const link = await upsertEventLink(db, {
    userEmail: session.email,
    provider,
    providerEventId,
    calendarId,
    clientId: isUnlink ? null : clientId,
    matterId: isUnlink ? null : (matterId || null),
    workstream: isUnlink ? null : (workstream || null),
    linkStatus: isUnlink ? "unlinked" : "linked",
    linkedBy: session.name,
  });
  return Response.json({ ok: true, link }, { headers: { "Cache-Control": "no-store" } });
};
export const config: Config = { path: "/api/calendar/link" };
