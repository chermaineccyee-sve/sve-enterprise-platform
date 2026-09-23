import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { verifySessionCookie } from "./_auth-core.mts";
import { deleteConnection } from "./_calendar-model.mts";

/** Deletes the stored (encrypted) connection — this app's own access stops
 * immediately. Does not itself revoke the grant on Google's side (that
 * remains a Google-account action, outside this app's control); the UI
 * says so rather than overpromise. Never touches the Executive Vault
 * account/session itself — disconnecting a calendar cannot log anyone out. */
export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const sessionSecret = Netlify.env.get("EXECUTIVE_VAULT_SESSION_SECRET");
  if (!sessionSecret) return Response.json({ error: "Authentication is not configured." }, { status: 503 });
  const session = await verifySessionCookie(req.headers.get("cookie"), sessionSecret);
  if (!session) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const { provider } = await req.json().catch(() => ({}));
  if (provider !== "google") return Response.json({ error: "Unsupported calendar provider." }, { status: 400 });

  const db = getDatabase();
  await deleteConnection(db, session.email, "google");
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
};
export const config: Config = { path: "/api/calendar/disconnect" };
