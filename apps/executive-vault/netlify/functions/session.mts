import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { verifySessionCookie, sessionClearCookieHeader } from "./_auth-core.mts";

export default async (req: Request, _context: Context) => {
  const secret = Netlify.env.get("EXECUTIVE_VAULT_SESSION_SECRET");
  if (!secret) return Response.json({ authenticated: false }, { status: 503 });

  const session = await verifySessionCookie(req.headers.get("cookie"), secret);
  if (!session) return Response.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const db = getDatabase();
  const [account] = await db.sql`SELECT email, name, status FROM command_centre_users WHERE LOWER(email) = ${session.email.toLowerCase()} LIMIT 1`;
  if (!account || account.status !== "Active") {
    return Response.json(
      { authenticated: false },
      { status: 401, headers: { "Set-Cookie": sessionClearCookieHeader(), "Cache-Control": "no-store" } }
    );
  }

  return Response.json(
    { authenticated: true, user: { email: String(account.email), name: String(account.name) } },
    { headers: { "Cache-Control": "no-store" } }
  );
};
export const config: Config = { path: "/api/session" };
