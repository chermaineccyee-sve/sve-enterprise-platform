/**
 * Resolves the authenticated actor for this package's routes — a native
 * Identity bearer session only (mirrors platform-services/hrms's own
 * middleware/actor.ts exactly).
 */
import type { IncomingMessage } from "node:http";
import type { WorkflowContainer } from "../../composition/container.ts";
import { SessionInvalidError, AccountDisabledError } from "../../../../identity/src/domain/errors.ts";

export interface Actor {
  userId: string;
  email: string;
}

export async function requireActor(req: IncomingMessage, container: WorkflowContainer): Promise<Actor> {
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
