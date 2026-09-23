import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { verifySessionCookie } from "./_auth-core.mts";
import { getConnection } from "./_calendar-model.mts";

/** Connected/Not Connected state for the Connected Calendars screen — provider-neutral shape (an array), even though only "google" exists today, so Outlook adds a second entry later without a response-shape change. Never returns a token, only status/account/last-synced. */
export default async (req: Request, _context: Context) => {
  const sessionSecret = Netlify.env.get("EXECUTIVE_VAULT_SESSION_SECRET");
  if (!sessionSecret) return Response.json({ error: "Authentication is not configured." }, { status: 503 });
  const session = await verifySessionCookie(req.headers.get("cookie"), sessionSecret);
  if (!session) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const db = getDatabase();
  const connection = await getConnection(db, session.email, "google");
  if (!connection || connection.status === "disconnected") {
    return Response.json({ providers: [{ provider: "google", connected: false }] }, { headers: { "Cache-Control": "no-store" } });
  }

  return Response.json({
    providers: [{
      provider: "google",
      connected: true,
      status: connection.status,
      accountEmail: connection.provider_account_email,
      lastSyncedAt: connection.last_synced_at,
      lastError: connection.status === "connected" ? null : connection.last_error,
    }],
  }, { headers: { "Cache-Control": "no-store" } });
};
export const config: Config = { path: "/api/calendar/status" };
