import type { Context, Config } from "@netlify/functions";
import { verifySessionCookie } from "./_auth-core.mts";
import { signOAuthState } from "./_calendar-state.mts";
import { buildGoogleAuthUrl } from "./_calendar-google.mts";

/** Starts the OAuth flow — only for an already-authenticated Executive Vault user (the session boundary this whole feature sits behind). Redirects straight to Google; nothing here ever touches localStorage/sessionStorage, and the client secret never leaves this Function. */
export default async (req: Request, _context: Context) => {
  const sessionSecret = Netlify.env.get("EXECUTIVE_VAULT_SESSION_SECRET");
  if (!sessionSecret) return Response.json({ error: "Authentication is not configured." }, { status: 503 });
  const session = await verifySessionCookie(req.headers.get("cookie"), sessionSecret);
  if (!session) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const url = new URL(req.url);
  const provider = url.searchParams.get("provider");
  if (provider !== "google") return Response.json({ error: "Unsupported calendar provider." }, { status: 400 });

  // Trimmed defensively — a stray leading/trailing space or newline from how
  // the value was set in Netlify (a copy/paste, a `netlify env:set` from a
  // file) would otherwise silently become part of client_id/redirect_uri,
  // and must trim identically here and in calendar-google-callback.mts's
  // token exchange so the SAME value is sent to Google at both the
  // authorize step and the token-exchange step. Never alters the secret's
  // actual characters — only surrounding whitespace, which is never part of
  // a real client ID or URI.
  const clientId = Netlify.env.get("GOOGLE_CALENDAR_CLIENT_ID")?.trim();
  const redirectUri = Netlify.env.get("GOOGLE_CALENDAR_REDIRECT_URI")?.trim();
  if (!clientId || !redirectUri) return Response.json({ error: "Google Calendar is not configured." }, { status: 503 });

  const state = await signOAuthState(session.email, "google", sessionSecret);
  return Response.redirect(buildGoogleAuthUrl(clientId, redirectUri, state), 302);
};
export const config: Config = { path: "/api/calendar/connect" };
