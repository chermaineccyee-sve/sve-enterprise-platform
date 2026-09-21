
-- Executive Vault (Personal Executive Command Centre) — Layer 1 authentication.
--
-- Deliberately minimal compared to apps/svegip's employee_accounts table: no
-- role/unit/permissions columns, because this app has exactly one authorised
-- user today and no RBAC concept. It is still a proper user table keyed by
-- email (not a single opaque shared-password check) so it can evolve to more
-- than one row later without a schema rewrite — see docs/architecture/
-- executive-command-centre-authentication.md.
CREATE TABLE IF NOT EXISTS command_centre_users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 210000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS command_centre_users_status_idx ON command_centre_users(status);
