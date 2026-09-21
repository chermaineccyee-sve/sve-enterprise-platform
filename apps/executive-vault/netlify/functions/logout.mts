import type { Context, Config } from "@netlify/functions";
import { sessionClearCookieHeader } from "./_auth-core.mts";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": sessionClearCookieHeader(), "Cache-Control": "no-store" } }
  );
};
export const config: Config = { path: "/api/logout" };
