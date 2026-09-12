/**
 * /api/v1/users/me only — deliberately minimal. See item 14 of the PR
 * brief: do not expose a broad user-administration API just because the
 * underlying tables exist.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Container } from "../../container.ts";
import { sendSuccess, sendError } from "../middleware/envelope.ts";
import { requireSession } from "../middleware/authContext.ts";
import { SessionInvalidError } from "../../domain/errors.ts";

interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  container: Container;
  correlationId: string;
}

export async function handleGetMe(ctx: RouteContext): Promise<void> {
  try {
    const session = await requireSession(ctx.req, ctx.container);
    const user = await ctx.container.users.findById(session.userId);
    if (!user) return sendError(ctx.res, 401, "SESSION_INVALID", "Not authenticated.", ctx.correlationId);
    // No password/credential fields exist on this shape to accidentally leak.
    sendSuccess(ctx.res, 200, { id: user.id, email: user.email, accountType: user.accountType, status: user.status }, ctx.correlationId);
  } catch (error) {
    if (error instanceof SessionInvalidError) return sendError(ctx.res, 401, "SESSION_INVALID", "Not authenticated.", ctx.correlationId);
    throw error;
  }
}
