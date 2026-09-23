-- Google Calendar Integration v1 — provider-neutral calendar storage.
--
-- Two tables, deliberately shaped so Microsoft Outlook (deferred, not this
-- phase) slots into the SAME tables later via `provider = 'outlook'` rather
-- than a parallel schema — see docs/architecture/outlook-calendar-readiness-
-- review.md, whose "thin join, never copy provider-owned facts" principle
-- calendar_event_links follows exactly.

-- calendar_connections: one row per connected provider account. Tokens are
-- AES-256-GCM encrypted at rest (see _calendar-crypto.mts) — this table
-- never holds a plaintext access/refresh token. user_email ties a
-- connection to the single command_centre_users account (shaped to extend
-- to more than one user later without a schema rewrite, exactly like that
-- table's own design note).
CREATE TABLE IF NOT EXISTS calendar_connections (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL REFERENCES command_centre_users(email),
  provider TEXT NOT NULL,                          -- 'google' today; 'outlook' later
  provider_account_email TEXT NOT NULL,             -- the connected calendar account's own email
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,                     -- nullable: a refresh attempt that returns no new token keeps the existing one; only absent before the very first grant
  token_expires_at TIMESTAMPTZ,
  scope TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected',         -- 'connected' | 'expired' | 'error' | 'disconnected'
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_email, provider, provider_account_email)
);
CREATE INDEX IF NOT EXISTS calendar_connections_user_provider_idx ON calendar_connections(user_email, provider);

-- calendar_event_links: the user-controlled "Link to Matter" action (never
-- automatic). Only a relationship record — title/time/attendees etc. stay
-- live in the provider and are fetched fresh on every call, never copied
-- here. link_status defaults 'unlinked': every synced event starts this
-- way until Ching Yee explicitly links (or dismisses) it.
CREATE TABLE IF NOT EXISTS calendar_event_links (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL REFERENCES command_centre_users(email),
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  client_id TEXT,
  matter_id TEXT,
  workstream TEXT,
  link_status TEXT NOT NULL DEFAULT 'unlinked',     -- 'unlinked' | 'linked' | 'ignored'
  linked_at TIMESTAMPTZ,
  linked_by TEXT,                                   -- always the account's own name today; kept for shape-stability, not a multi-user need yet
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_email, provider, provider_event_id, calendar_id)
);
CREATE INDEX IF NOT EXISTS calendar_event_links_lookup_idx ON calendar_event_links(user_email, provider, calendar_id);
