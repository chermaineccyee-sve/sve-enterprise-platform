/**
 * PR #11: a thin, authenticated reverse-proxy from apps/svegip's own
 * same-origin Netlify Functions to a platform-services HTTP API
 * (organisation / hrms / workflow). This is the ONE place apps/svegip
 * reaches into platform-services — every People/HRMS screen goes through
 * one of the three per-service function files that call this helper,
 * never a direct browser fetch to a platform-services port.
 *
 * What this does and does not do:
 *  - Fails fast on the SVEGIP session itself (resolveLiveSecurityContext,
 *    same check every other authenticated Netlify function in this app
 *    already uses) BEFORE ever making an outbound request — an
 *    unauthenticated SVEGIP visitor never reaches platform-services at
 *    all, and this proxy never runs with elevated/service credentials.
 *  - Forwards the ORIGINAL request's Cookie/Origin/Referer headers
 *    unmodified. It does not mint a session, does not assert an identity
 *    of its own accord, and does not read the SVEGIP cookie's role/unit/
 *    permissions claims — the target platform-service independently
 *    re-verifies the SAME svegip_session cookie via its own
 *    svegipSessionBridge + users/RBAC lookup (see platform-services/
 *    {organisation,hrms,workflow}/src/api/middleware/actor.ts) and makes
 *    its own, completely independent authorization decision. This proxy
 *    is transport only — it is not a second, competing source of
 *    authority (see identity/src/services/svegipSessionBridge.ts's own
 *    header comment on why that would be a mistake).
 *  - Is a server-to-server call (Netlify Function -> platform-services
 *    Node HTTP server), so browser CORS rules never apply here — only
 *    the browser-to-apps/svegip leg is same-origin.
 *  - Base URLs are environment-configured, defaulting to the same
 *    localhost ports each service's own server.ts binds to in
 *    development/CI. PRODUCTION reachability of platform-services (i.e.
 *    deploying it somewhere this proxy's outbound fetch can reach) is an
 *    explicit, documented precondition of this PR, not something it
 *    solves — see docs/architecture/hrms-application-shell.md "Frontend/
 *    backend boundaries".
 */
import { resolveLiveSecurityContext, authorizationResponse } from "./_auth-core.mts";

// Never forwarded upstream: `host` would misdirect the request to the
// wrong virtual host on the target server, and `content-length` is
// recomputed by `fetch` itself from the body it is actually given.
const EXCLUDED_REQUEST_HEADERS = new Set(["host", "content-length"]);

export async function proxyToPlatformService(req: Request, baseUrlEnvVar: string, defaultBaseUrl: string): Promise<Response> {
  try {
    await resolveLiveSecurityContext(req);
  } catch (error) {
    return authorizationResponse(error);
  }

  const base = Netlify.env.get(baseUrlEnvVar) || defaultBaseUrl;
  const incoming = new URL(req.url);
  let target: URL;
  try {
    target = new URL(base.replace(/\/+$/, "") + incoming.pathname + incoming.search);
  } catch {
    console.error("Platform-service proxy misconfigured base URL", { baseUrlEnvVar, base });
    return Response.json({ error: { message: "The requested service is currently unavailable." } }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }

  const headers = new Headers();
  for (const [key, value] of req.headers) {
    if (EXCLUDED_REQUEST_HEADERS.has(key.toLowerCase())) continue;
    headers.set(key, value);
  }

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (error) {
    console.error("Platform-service proxy request failed", { baseUrlEnvVar, target: target.toString(), message: (error as Error)?.message });
    return Response.json({ error: { message: "The requested service is currently unavailable." } }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" },
  });
}
