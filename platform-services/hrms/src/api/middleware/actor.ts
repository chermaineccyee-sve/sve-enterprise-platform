/**
 * Resolves the authenticated actor for this package's routes — a native
 * Identity bearer session only (see composition/container.ts's header
 * comment on why no SVEGIP cookie bridge exists here).
 */
import type { IncomingMessage } from "node:http";
import type { HrmsContainer } from "../../composition/container.ts";
import { SessionInvalidError, AccountDisabledError } from "../../../../identity/src/domain/errors.ts";

export interface Actor {
  userId: string;
  email: string;
}

export async function requireActor(req: IncomingMessage, container: HrmsContainer): Promise<Actor> {
  const authHeader = req.headers["authorization"];
  const match = typeof authHeader === "string" ? authHeader.match(/^Bearer (.+)$/) : null;
  if (!match) throw new SessionInvalidError("not_found");
  const session = await container.sessions.validateSession(match[1]!);
  const user = await container.users.findById(session.userId);
  if (!user) throw new SessionInvalidError("not_found");
  if (user.status !== "active") throw new AccountDisabledError();
  return { userId: user.id, email: user.email };
}

export function clientIp(req: IncomingMessage): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) return forwarded.split(",")[0]!.trim();
  return req.socket.remoteAddress ?? null;
}
