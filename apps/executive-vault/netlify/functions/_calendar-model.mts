/**
 * Provider-neutral DB access for calendar_connections/calendar_event_links —
 * every calendar HTTP Function reads/writes through these, never a raw
 * `db.sql` of its own, so the encrypt-at-rest and refresh-token-preservation
 * rules only ever need to be correct in one place.
 */
import { encryptToken } from "./_calendar-crypto.mts";

export interface ConnectionRow {
  id: number;
  user_email: string;
  provider: string;
  provider_account_email: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  scope: string;
  status: "connected" | "expired" | "error" | "disconnected";
  last_synced_at: string | null;
  last_error: string | null;
}

export async function getConnection(db: any, userEmail: string, provider: string): Promise<ConnectionRow | null> {
  const rows = await db.sql`SELECT * FROM calendar_connections WHERE user_email = ${userEmail} AND provider = ${provider} LIMIT 1`;
  return rows[0] || null;
}

/** First-time connect (OAuth callback) — always has both tokens, since access_type=offline+prompt=consent guarantees a refresh_token on this path. Re-running Connect for the same account updates the existing row (ON CONFLICT) rather than creating a duplicate. */
export async function upsertConnectionAfterAuth(db: any, params: {
  userEmail: string; provider: string; providerAccountEmail: string;
  accessToken: string; refreshToken: string; expiresAt: string; scope: string; encryptionKey: string;
}): Promise<ConnectionRow> {
  const accessEnc = await encryptToken(params.accessToken, params.encryptionKey);
  const refreshEnc = await encryptToken(params.refreshToken, params.encryptionKey);
  const rows = await db.sql`
    INSERT INTO calendar_connections
      (user_email, provider, provider_account_email, access_token_encrypted, refresh_token_encrypted, token_expires_at, scope, status, last_error, updated_at)
    VALUES
      (${params.userEmail}, ${params.provider}, ${params.providerAccountEmail}, ${accessEnc}, ${refreshEnc}, ${params.expiresAt}, ${params.scope}, 'connected', NULL, NOW())
    ON CONFLICT (user_email, provider, provider_account_email) DO UPDATE SET
      access_token_encrypted = EXCLUDED.access_token_encrypted,
      refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
      token_expires_at = EXCLUDED.token_expires_at,
      scope = EXCLUDED.scope,
      status = 'connected',
      last_error = NULL,
      updated_at = NOW()
    RETURNING *
  `;
  return rows[0];
}

/** A refreshed access token. refreshToken is optional — Google does not always rotate it, and omitting it here means the previously stored one is left untouched (never cleared, never overwritten with nothing). */
export async function updateAccessToken(db: any, id: number, params: { accessToken: string; refreshToken?: string | null; expiresAt: string; encryptionKey: string }): Promise<void> {
  const accessEnc = await encryptToken(params.accessToken, params.encryptionKey);
  if (params.refreshToken) {
    const refreshEnc = await encryptToken(params.refreshToken, params.encryptionKey);
    await db.sql`UPDATE calendar_connections SET access_token_encrypted = ${accessEnc}, refresh_token_encrypted = ${refreshEnc}, token_expires_at = ${params.expiresAt}, status = 'connected', last_error = NULL, updated_at = NOW() WHERE id = ${id}`;
  } else {
    await db.sql`UPDATE calendar_connections SET access_token_encrypted = ${accessEnc}, token_expires_at = ${params.expiresAt}, status = 'connected', last_error = NULL, updated_at = NOW() WHERE id = ${id}`;
  }
}

export async function markSynced(db: any, id: number): Promise<void> {
  await db.sql`UPDATE calendar_connections SET last_synced_at = NOW(), status = 'connected', last_error = NULL, updated_at = NOW() WHERE id = ${id}`;
}

/** 'expired' (refresh token no longer valid — needs reconnect) vs 'error' (transient provider failure — retry may succeed) are surfaced distinctly to the UI (§9 of the readiness review). */
export async function markConnectionError(db: any, id: number, status: "expired" | "error", message: string): Promise<void> {
  await db.sql`UPDATE calendar_connections SET status = ${status}, last_error = ${message}, updated_at = NOW() WHERE id = ${id}`;
}

/** Deletes the stored connection outright — this app's own access stops immediately; it does not itself reach into Google to revoke the grant (that remains a Google-account-side action, stated plainly in the UI). */
export async function deleteConnection(db: any, userEmail: string, provider: string): Promise<void> {
  await db.sql`DELETE FROM calendar_connections WHERE user_email = ${userEmail} AND provider = ${provider}`;
}

export interface EventLinkRow {
  provider_event_id: string;
  calendar_id: string;
  client_id: string | null;
  matter_id: string | null;
  workstream: string | null;
  link_status: "unlinked" | "linked" | "ignored";
  linked_at: string | null;
}

export async function getEventLinks(db: any, userEmail: string, provider: string, calendarId: string): Promise<EventLinkRow[]> {
  return db.sql`SELECT provider_event_id, calendar_id, client_id, matter_id, workstream, link_status, linked_at FROM calendar_event_links WHERE user_email = ${userEmail} AND provider = ${provider} AND calendar_id = ${calendarId}`;
}

/** The ONLY place clientId/matterId/workstream ever gets set on a calendar event — always called from an explicit user action (calendar-link.mts), never from any matching/suggestion logic. */
export async function upsertEventLink(db: any, params: {
  userEmail: string; provider: string; providerEventId: string; calendarId: string;
  clientId: string | null; matterId: string | null; workstream: string | null;
  linkStatus: "unlinked" | "linked" | "ignored"; linkedBy: string;
}): Promise<EventLinkRow> {
  const rows = await db.sql`
    INSERT INTO calendar_event_links
      (user_email, provider, provider_event_id, calendar_id, client_id, matter_id, workstream, link_status, linked_at, linked_by, updated_at)
    VALUES
      (${params.userEmail}, ${params.provider}, ${params.providerEventId}, ${params.calendarId}, ${params.clientId}, ${params.matterId}, ${params.workstream}, ${params.linkStatus}, NOW(), ${params.linkedBy}, NOW())
    ON CONFLICT (user_email, provider, provider_event_id, calendar_id) DO UPDATE SET
      client_id = EXCLUDED.client_id,
      matter_id = EXCLUDED.matter_id,
      workstream = EXCLUDED.workstream,
      link_status = EXCLUDED.link_status,
      linked_at = NOW(),
      linked_by = EXCLUDED.linked_by,
      updated_at = NOW()
    RETURNING provider_event_id, calendar_id, client_id, matter_id, workstream, link_status, linked_at
  `;
  return rows[0];
}
