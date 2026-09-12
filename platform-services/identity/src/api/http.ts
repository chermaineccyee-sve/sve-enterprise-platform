/**
 * Minimal HTTP server for /api/v1/auth and /api/v1/users — no framework
 * (Express, Fastify, etc.): with roughly a dozen routes, Node's built-in
 * `http` module plus a small manual path/method table is simpler and has
 * zero additional dependencies. See docs/architecture/identity-foundation.md
 * "Why no HTTP framework".
 *
 * Scope: Identity/access/session/MFA routes only — Data Vault's
 * /api/v1/data-vault/* routes are served by platform-services/data-vault's
 * own HTTP server (src/api/http.ts there), not mounted here. See
 * docs/architecture/data-vault-foundation.md "Module ownership and
 * dependency direction".
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Container } from "../container.ts";
import { getOrCreateCorrelationId, sendError } from "./middleware/envelope.ts";
import * as authRoutes from "./routes/auth.ts";
import * as mfaRoutes from "./routes/mfa.ts";
import * as usersRoutes from "./routes/users.ts";
import { ThrottledError } from "../domain/errors.ts";

type Handler = (ctx: { req: IncomingMessage; res: ServerResponse; container: Container; correlationId: string }) => Promise<void>;

const STATIC_ROUTES: Record<string, Record<string, Handler>> = {
  "/api/v1/auth/login": { POST: authRoutes.handleLogin },
  "/api/v1/auth/mfa/verify": { POST: authRoutes.handleMfaVerify },
  "/api/v1/auth/mfa/recovery": { POST: authRoutes.handleMfaRecovery },
  "/api/v1/auth/logout": { POST: authRoutes.handleLogout },
  "/api/v1/auth/session": { GET: authRoutes.handleGetCurrentSession },
  "/api/v1/auth/sessions": { GET: authRoutes.handleListSessions },
  "/api/v1/auth/sessions/revoke-all": { POST: authRoutes.handleRevokeAllSessions },
  "/api/v1/auth/mfa/enrol": { POST: mfaRoutes.handleBeginEnrolment },
  "/api/v1/auth/mfa/enrol/verify": { POST: mfaRoutes.handleVerifyEnrolment },
  "/api/v1/auth/mfa/recovery-codes/regenerate": { POST: mfaRoutes.handleRegenerateRecoveryCodes },
  "/api/v1/auth/mfa/disable": { POST: mfaRoutes.handleDisableMfa },
  "/api/v1/users/me": { GET: usersRoutes.handleGetMe },
};

const SESSION_REVOKE_PATTERN = /^\/api\/v1\/auth\/sessions\/([^/]+)\/revoke$/;

export function createHttpServer(container: Container) {
  return createServer(async (req, res) => {
    const correlationId = getOrCreateCorrelationId(req);
    const url = new URL(req.url ?? "/", "http://localhost");
    const method = req.method ?? "GET";

    try {
      const staticRoute = STATIC_ROUTES[url.pathname];
      if (staticRoute) {
        const handler = staticRoute[method];
        if (!handler) return sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.", correlationId);
        return await handler({ req, res, container, correlationId });
      }

      const revokeMatch = url.pathname.match(SESSION_REVOKE_PATTERN);
      if (revokeMatch && method === "POST") {
        return await authRoutes.handleRevokeOneSession({ req, res, container, correlationId }, revokeMatch[1]!);
      }

      return sendError(res, 404, "NOT_FOUND", "Not found.", correlationId);
    } catch (error) {
      if (error instanceof ThrottledError) {
        res.setHeader("Retry-After", String(error.retryAfterSeconds));
        return sendError(res, 429, "AUTH_THROTTLED", "Too many attempts.", correlationId);
      }
      // eslint-disable-next-line no-console
      console.error("Unhandled error", { correlationId, message: (error as Error)?.message });
      return sendError(res, 500, "INTERNAL_ERROR", "An unexpected error occurred.", correlationId);
    }
  });
}
