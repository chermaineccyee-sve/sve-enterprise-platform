import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { verifySessionCookie } from "./_auth-core.mts";
import { decryptToken } from "./_calendar-crypto.mts";
import { fetchGoogleEvents, normalizeGoogleEvent, refreshAccessToken } from "./_calendar-google.mts";
import { getConnection, updateAccessToken, markSynced, markConnectionError, getEventLinks } from "./_calendar-model.mts";

const CALENDAR_ID = "primary"; // v1: the account's primary calendar only

/** Normalized events for [start, end) — the same fetch this endpoint serves
 * doubles as "Refresh" (there's no separate sync Function for v1, per the
 * fetch-on-open/manual-refresh brief): every successful call updates
 * last_synced_at. Refreshes the access token proactively when it's near
 * expiry, and reactively on a 401 mid-fetch (one retry, never a loop). A
 * refresh failure marks the connection 'expired' (needs reconnect) rather
 * than 'error' (transient) — the frontend shows the right message for each. */
export default async (req: Request, _context: Context) => {
  const sessionSecret = Netlify.env.get("EXECUTIVE_VAULT_SESSION_SECRET");
  if (!sessionSecret) return Response.json({ error: "Authentication is not configured." }, { status: 503 });
  const session = await verifySessionCookie(req.headers.get("cookie"), sessionSecret);
  if (!session) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if (!start || !end) return Response.json({ error: "start and end query parameters (ISO instants) are required." }, { status: 400 });

  const db = getDatabase();
  const connection = await getConnection(db, session.email, "google");
  if (!connection || connection.status === "disconnected") {
    return Response.json({ connected: false, events: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const encryptionKey = Netlify.env.get("EXECUTIVE_VAULT_TOKEN_ENCRYPTION_KEY");
  const clientId = Netlify.env.get("GOOGLE_CALENDAR_CLIENT_ID");
  const clientSecret = Netlify.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
  if (!encryptionKey || !clientId || !clientSecret) return Response.json({ error: "Google Calendar is not configured." }, { status: 503 });

  const doRefresh = async (): Promise<string> => {
    if (!connection.refresh_token_encrypted) {
      throw Object.assign(new Error("No refresh token on file."), { authFailure: true });
    }
    const refreshToken = await decryptToken(connection.refresh_token_encrypted, encryptionKey);
    const refreshed = await refreshAccessToken(refreshToken, clientId, clientSecret);
    await updateAccessToken(db, connection.id, {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || null, // preserve the existing refresh token when Google doesn't rotate it
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      encryptionKey,
    });
    return refreshed.access_token;
  };

  try {
    let accessToken = await decryptToken(connection.access_token_encrypted, encryptionKey);
    const expiresAtMs = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
    if (!connection.token_expires_at || expiresAtMs - Date.now() < 2 * 60 * 1000) {
      accessToken = await doRefresh();
    }

    let rawEvents: any[];
    try {
      rawEvents = await fetchGoogleEvents(accessToken, CALENDAR_ID, start, end);
    } catch (err: any) {
      if (err.status === 401) {
        accessToken = await doRefresh();
        rawEvents = await fetchGoogleEvents(accessToken, CALENDAR_ID, start, end);
      } else {
        throw err;
      }
    }

    const fetchedAtIso = new Date().toISOString();
    const normalized = rawEvents.map((raw) => normalizeGoogleEvent(raw, CALENDAR_ID, fetchedAtIso));
    const links = await getEventLinks(db, session.email, "google", CALENDAR_ID);
    const linkByEventId = new Map(links.map((l) => [l.provider_event_id, l]));
    const events = normalized.map((ev) => {
      const link = linkByEventId.get(ev.providerEventId);
      return {
        ...ev,
        link: link
          ? { clientId: link.client_id, matterId: link.matter_id, workstream: link.workstream, linkStatus: link.link_status }
          : { clientId: null, matterId: null, workstream: null, linkStatus: "unlinked" },
      };
    });

    await markSynced(db, connection.id);
    return Response.json(
      { connected: true, status: "connected", accountEmail: connection.provider_account_email, lastSyncedAt: fetchedAtIso, events },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("Google Calendar events fetch error", err.message || err);
    const isAuthFailure = err.authFailure === true || err.status === 401;
    const status = isAuthFailure ? "expired" : "error";
    await markConnectionError(db, connection.id, status, isAuthFailure ? "Re-authorisation required." : "Google Calendar is temporarily unavailable.");
    return Response.json(
      {
        connected: true,
        status,
        error: isAuthFailure
          ? "Your Google Calendar connection needs to be re-authorised."
          : "Google Calendar is temporarily unavailable. Please try again shortly.",
        events: [],
      },
      { status: isAuthFailure ? 401 : 502, headers: { "Cache-Control": "no-store" } }
    );
  }
};
export const config: Config = { path: "/api/calendar/events" };
