import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { hashPassword } from "./_auth-core.mts";

/**
 * One-time creation of the single authorised Executive Command Centre
 * account (Ching Yee), mirroring apps/svegip's netlify/functions/
 * bootstrap-admin.mts exactly: guarded by a temporary shared secret (set,
 * used once, then removed — see .env.example), and self-disabling the
 * moment command_centre_users has its first row. This is deliberately NOT
 * a standing shared-application-password check at login time — it exists
 * only to let the account holder set their own real email/password once,
 * after which every login verifies that specific account's own credential
 * (netlify/functions/login.mts), never this endpoint or its secret again.
 *
 * Single-user for now by design (docs/architecture/
 * executive-command-centre-authentication.md): this refuses to create a
 * second row rather than silently allowing multiple accounts. Removing
 * that refusal later (a proper invite/admin flow) is a small, deliberate
 * change, not a schema rewrite.
 */
export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const expected = Netlify.env.get("EXECUTIVE_VAULT_BOOTSTRAP_SECRET");
  const provided = req.headers.get("x-bootstrap-secret");
  if (!expected || provided !== expected) return Response.json({ error: "Forbidden" }, { status: 403 });

  const db = getDatabase();
  const [count] = await db.sql`SELECT COUNT(*)::int AS count FROM command_centre_users`;
  if (count.count > 0) {
    return Response.json({ error: "Bootstrap is disabled after the first account exists." }, { status: 409 });
  }

  const { email, name, password } = await req.json().catch(() => ({}));
  if (!email || !name || String(password || "").length < 12) {
    return Response.json({ error: "Valid email, name and a password of at least 12 characters are required." }, { status: 400 });
  }

  const { salt, hash, iterations } = await hashPassword(String(password));
  await db.sql`INSERT INTO command_centre_users (email, name, status, password_salt, password_hash, password_iterations)
    VALUES (${String(email).toLowerCase()}, ${name}, ${"Active"}, ${salt}, ${hash}, ${iterations})`;

  return Response.json({ ok: true }, { status: 201 });
};
export const config: Config = { path: "/api/bootstrap-user" };
