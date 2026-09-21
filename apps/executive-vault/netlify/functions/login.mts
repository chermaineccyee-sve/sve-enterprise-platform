import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { verifyPasswordHash, signSessionCookie, sessionSetCookieHeader } from "./_auth-core.mts";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const secret = Netlify.env.get("EXECUTIVE_VAULT_SESSION_SECRET");
  if (!secret) return Response.json({ error: "Authentication is not configured." }, { status: 503 });

  const { email, password } = await req.json().catch(() => ({}));
  const normalisedEmail = String(email || "").trim().toLowerCase();
  if (!normalisedEmail || !password) return Response.json({ error: "Email and password are required." }, { status: 400 });

  const db = getDatabase();
  const [account] = await db.sql`SELECT email, name, status, password_salt, password_hash, password_iterations FROM command_centre_users WHERE LOWER(email) = ${normalisedEmail} LIMIT 1`;
  if (!account || account.status !== "Active") {
    return Response.json({ error: "Invalid email or password." }, { status: 401 });
  }
  const valid = await verifyPasswordHash(String(password), account.password_salt, account.password_hash, account.password_iterations || 210000);
  if (!valid) return Response.json({ error: "Invalid email or password." }, { status: 401 });

  const user = { email: String(account.email), name: String(account.name) };
  const cookieValue = await signSessionCookie(user, secret);
  return Response.json(
    { ok: true, user },
    { headers: { "Set-Cookie": sessionSetCookieHeader(cookieValue), "Cache-Control": "no-store" } }
  );
};
export const config: Config = { path: "/api/login" };
