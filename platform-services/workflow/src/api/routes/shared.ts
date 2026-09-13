import type { IncomingMessage, ServerResponse } from "node:http";
import type { WorkflowContainer } from "../../composition/container.ts";
import { sendError } from "../../../../identity/src/api/middleware/envelope.ts";
import { clientIp } from "../middleware/actor.ts";
import { SessionInvalidError, AccountDisabledError, ForbiddenError } from "../../../../identity/src/domain/errors.ts";
import { NotFoundError, ValidationError, InvalidStateError } from "../../domain/errors.ts";

export interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  container: WorkflowContainer;
  correlationId: string;
}

export function respondError(res: ServerResponse, correlationId: string, error: unknown): void {
  if (error instanceof SessionInvalidError) return sendError(res, 401, "SESSION_INVALID", "Not authenticated.", correlationId);
  if (error instanceof AccountDisabledError) return sendError(res, 403, "ACCOUNT_DISABLED", "Account is disabled.", correlationId);
  if (error instanceof NotFoundError) return sendError(res, 404, "NOT_FOUND", "Not found.", correlationId);
  if (error instanceof ForbiddenError) return sendError(res, 403, "FORBIDDEN", "Not authorised for this action.", correlationId);
  if (error instanceof InvalidStateError) return sendError(res, 409, "INVALID_STATE", error.message, correlationId);
  if (error instanceof ValidationError) return sendError(res, 400, "VALIDATION_ERROR", error.message, correlationId);
  throw error;
}

export function toActorContext(actor: { userId: string; email: string }, req: IncomingMessage) {
  return { userId: actor.userId, email: actor.email, ip: clientIp(req), userAgent: (req.headers["user-agent"] as string | undefined) ?? null };
}
