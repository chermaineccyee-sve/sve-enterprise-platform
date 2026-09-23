/**
 * Google Calendar — the ONLY module in this codebase that talks to Google.
 * Read-only: every call here is a GET against the Calendar API, or a token
 * exchange/refresh. Never event creation/edit/delete, never Gmail/Contacts/
 * Drive. HTTP Functions call into this module; the frontend never does.
 */
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://www.googleapis.com/calendar/v3";
export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string; // absent on a refresh call unless Google rotates it — see refreshAccessToken()'s own note
  expires_in: number;     // seconds
  scope: string;
  token_type: string;
}

/** Builds the consent-screen URL. access_type=offline + prompt=consent (not a scope — a request parameter) is what makes Google issue a refresh token. */
export function buildGoogleAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, clientId: string, clientSecret: string, redirectUri: string): Promise<GoogleTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  return res.json();
}

/** Google does not always return a new refresh_token on refresh — callers MUST keep the previous one when this response omits it (see calendar-model's upsertConnection). */
export async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string): Promise<GoogleTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const err: any = new Error(`Google token refresh failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** The connected account's own email — read from the primary calendar's id, so no openid/email/profile scope is ever requested just to display who's connected. */
export async function fetchPrimaryCalendarEmail(accessToken: string): Promise<string> {
  const res = await fetch(`${API_BASE}/calendars/primary`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) { const err: any = new Error(`Could not read the primary calendar (${res.status})`); err.status = res.status; throw err; }
  const body = await res.json();
  return body.id as string;
}

export async function fetchGoogleEvents(accessToken: string, calendarId: string, timeMinIso: string, timeMaxIso: string): Promise<any[]> {
  const params = new URLSearchParams({
    timeMin: timeMinIso, timeMax: timeMaxIso, singleEvents: "true", orderBy: "startTime", maxResults: "250",
  });
  const res = await fetch(`${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) { const err: any = new Error(`Google Calendar events request failed (${res.status})`); err.status = res.status; throw err; }
  const body = await res.json();
  return (body.items || []).filter((e: any) => e.status !== "cancelled");
}

export interface NormalizedCalendarEvent {
  provider: "google";
  providerEventId: string;
  calendarId: string;
  title: string;
  start: string;   // ISO 8601 UTC instant
  end: string;     // ISO 8601 UTC instant
  allDay: boolean;
  timeZone: string; // the event's own IANA zone as Google reported it — for display fidelity, never assumed
  location: string | null;
  meetingUrl: string | null;
  organizer: { name: string | null; email: string | null } | null;
  attendees: Array<{ name: string | null; email: string | null; responseStatus: string | null }>;
  description: string | null;
  recurrence: string[] | null;
  recurringEventId: string | null;
  lastSynchronizedAt: string; // ISO instant this record was fetched, not the event's own lastModified
}

function meetingUrlFrom(raw: any): string | null {
  if (raw.hangoutLink) return raw.hangoutLink;
  const videoEntry = raw.conferenceData?.entryPoints?.find((p: any) => p.entryPointType === "video");
  return videoEntry?.uri || null;
}

/** Google -> the provider-neutral model. Pure and deterministic (fetchedAtIso is passed in, never read from a live clock inside this function) so it's directly unit-testable without mocking time. Never classifies into a Client/Matter/Workstream — that stays a separate, explicit, user-driven action (calendar_event_links). */
export function normalizeGoogleEvent(raw: any, calendarId: string, fetchedAtIso: string): NormalizedCalendarEvent {
  const allDay = !raw.start?.dateTime;
  const start = allDay ? `${raw.start.date}T00:00:00.000Z` : new Date(raw.start.dateTime).toISOString();
  const end = allDay ? `${raw.end.date}T00:00:00.000Z` : new Date(raw.end.dateTime).toISOString();
  return {
    provider: "google",
    providerEventId: raw.id,
    calendarId,
    title: raw.summary || "(No title)",
    start,
    end,
    allDay,
    timeZone: raw.start?.timeZone || raw.end?.timeZone || "UTC",
    location: raw.location || null,
    meetingUrl: meetingUrlFrom(raw),
    organizer: raw.organizer ? { name: raw.organizer.displayName || null, email: raw.organizer.email || null } : null,
    attendees: (raw.attendees || []).map((a: any) => ({ name: a.displayName || null, email: a.email || null, responseStatus: a.responseStatus || null })),
    description: raw.description || null,
    recurrence: raw.recurrence || null,
    recurringEventId: raw.recurringEventId || null,
    lastSynchronizedAt: fetchedAtIso,
  };
}
