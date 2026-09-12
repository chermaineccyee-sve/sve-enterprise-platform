/**
 * Resolves the authenticated session strictly from the server-side session
 * store via the bearer token — never from any client-supplied user/role
 * claim in the request body or headers. Every protected route calls this;
 * none trust anything else about who the caller is.
 */
import type { IncomingMessage } from "node:http";
import type { Container } from "../../container.ts";
import type { Session } from "../../domain/entities.ts";
import { SessionInvalidError } from "../../domain/errors.ts";

export async function requireSession(req: IncomingMessage, container: Container): Promise<Session> {
  const header = req.headers["authorization"];
  const match = typeof header === "string" ? header.match(/^Bearer (.+)$/) : null;
  if (!match) throw new SessionInvalidError("not_found");
  return container.sessions.validateSession(match[1]!);
}

export function clientIp(req: IncomingMessage): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) return forwarded.split(",")[0]!.trim();
  return req.socket.remoteAddress ?? null;
}
