import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { verifySessionCookie } from "./_auth-core.mts";
import { verifyOAuthState } from "./_calendar-state.mts";
import { exchangeCodeForTokens, fetchPrimaryCalendarEmail, GOOGLE_SCOPE } from "./_calendar-google.mts";
import { upsertConnectionAfterAuth } from "./_calendar-model.mts";

/** The exact-match redirect URI registered with Google. Validates the signed
 * OAuth state (present + unexpired + unmodified) AND that the current
 * request still carries a live Executive Vault session for the SAME
 * account the flow was started from — "initiated and completed" for an
 * authenticated user, checked at both ends, not just the first. Any
 * failure lands back in the app with a plain-language, non-technical
 * reason; never a raw error or stack trace. */
function backToApp(query: string) {
  return new Response(null, { status: 302, headers: { Location: `/#/calendars?${query}` } });
}

export default async (req: Request, _context: Context) => {
  const sessionSecret = Netlify.env.get("EXECUTIVE_VAULT_SESSION_SECRET");
  const encryptionKey = Netlify.env.get("EXECUTIVE_VAULT_TOKEN_ENCRYPTION_KEY");
  const clientId = Netlify.env.get("GOOGLE_CALENDAR_CLIENT_ID");
  const clientSecret = Netlify.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
  const redirectUri = Netlify.env.get("GOOGLE_CALENDAR_REDIRECT_URI");
  if (!sessionSecret || !encryptionKey || !clientId || !clientSecret || !redirectUri) {
    return backToApp("calendar=error&reason=not_configured");
  }

  const url = new URL(req.url);
  const providerError = url.searchParams.get("error");
  if (providerError) return backToApp(`calendar=error&reason=${encodeURIComponent(providerError)}`);

  const state = await verifyOAuthState(url.searchParams.get("state"), sessionSecret);
  const code = url.searchParams.get("code");
  if (!state || state.provider !== "google" || !code) {
    return backToApp("calendar=error&reason=invalid_state");
  }

  const session = await verifySessionCookie(req.headers.get("cookie"), sessionSecret);
  if (!session || session.email !== state.email) {
    return backToApp("calendar=error&reason=session_mismatch");
  }

  try {
    const tokens = await exchangeCodeForTokens(code, clientId, clientSecret, redirectUri);
    if (!tokens.refresh_token) {
      // Shouldn't happen with access_type=offline + prompt=consent, but never store a connection this app can't actually refresh later.
      return backToApp("calendar=error&reason=no_refresh_token");
    }
    const accountEmail = await fetchPrimaryCalendarEmail(tokens.access_token);
    const db = getDatabase();
    await upsertConnectionAfterAuth(db, {
      userEmail: session.email,
      provider: "google",
      providerAccountEmail: accountEmail,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scope: tokens.scope || GOOGLE_SCOPE,
      encryptionKey,
    });
    return backToApp("calendar=connected");
  } catch (err) {
    console.error("Google Calendar connect error", err);
    return backToApp("calendar=error&reason=exchange_failed");
  }
};
export const config: Config = { path: "/api/calendar/google/callback" };
