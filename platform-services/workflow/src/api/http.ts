/**
 * Minimal HTTP server for /api/v1/workflow — no framework, same
 * convention as platform-services/identity's/organisation's/hrms's own
 * src/api/http.ts. Only routes justified by this foundation exist.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { WorkflowContainer } from "../composition/container.ts";
import { getOrCreateCorrelationId, sendError } from "../../../identity/src/api/middleware/envelope.ts";
import * as definitionRoutes from "./routes/definitions.ts";
import * as instanceRoutes from "./routes/instances.ts";
import * as taskRoutes from "./routes/tasks.ts";

type Handler = (ctx: { req: IncomingMessage; res: ServerResponse; container: WorkflowContainer; correlationId: string }) => Promise<void>;

const STATIC_ROUTES: Record<string, Record<string, Handler>> = {
  "/api/v1/workflow/definitions": { GET: definitionRoutes.handleListDefinitions, POST: definitionRoutes.handleCreateDefinition },
  "/api/v1/workflow/instances": { GET: instanceRoutes.handleListInstances, POST: instanceRoutes.handleStartInstance },
  "/api/v1/workflow/tasks": { GET: taskRoutes.handleListAssignedTasks },
  "/api/v1/workflow/operations/process-escalations": { POST: taskRoutes.handleProcessEscalations },
};

const DEFINITION_PATTERN = /^\/api\/v1\/workflow\/definitions\/([^/]+)$/;
const DEFINITION_VERSIONS_PATTERN = /^\/api\/v1\/workflow\/definitions\/([^/]+)\/versions$/;
const VERSION_PATTERN = /^\/api\/v1\/workflow\/versions\/([^/]+)$/;
const VERSION_STEPS_PATTERN = /^\/api\/v1\/workflow\/versions\/([^/]+)\/steps$/;
const VERSION_STEP_PATTERN = /^\/api\/v1\/workflow\/versions\/([^/]+)\/steps\/([^/]+)$/;
const VERSION_PUBLISH_PATTERN = /^\/api\/v1\/workflow\/versions\/([^/]+)\/publish$/;
const VERSION_RETIRE_PATTERN = /^\/api\/v1\/workflow\/versions\/([^/]+)\/retire$/;

const INSTANCE_PATTERN = /^\/api\/v1\/workflow\/instances\/([^/]+)$/;
const INSTANCE_HISTORY_PATTERN = /^\/api\/v1\/workflow\/instances\/([^/]+)\/events$/;
const INSTANCE_CANCEL_PATTERN = /^\/api\/v1\/workflow\/instances\/([^/]+)\/cancel$/;

const TASK_PATTERN = /^\/api\/v1\/workflow\/tasks\/([^/]+)$/;
const TASK_DECIDE_PATTERN = /^\/api\/v1\/workflow\/tasks\/([^/]+)\/decide$/;
const TASK_COMPLETE_PATTERN = /^\/api\/v1\/workflow\/tasks\/([^/]+)\/complete$/;
const TASK_REASSIGN_PATTERN = /^\/api\/v1\/workflow\/tasks\/([^/]+)\/reassign$/;

export function createHttpServer(container: WorkflowContainer) {
  return createServer(async (req, res) => {
    const correlationId = getOrCreateCorrelationId(req);
    const url = new URL(req.url ?? "/", "http://localhost");
    const method = req.method ?? "GET";
    const ctx = { req, res, container, correlationId };

    try {
      const staticRoute = STATIC_ROUTES[url.pathname];
      if (staticRoute) {
        const handler = staticRoute[method];
        if (!handler) return sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.", correlationId);
        return await handler(ctx);
      }

      const versionsMatch = url.pathname.match(DEFINITION_VERSIONS_PATTERN);
      if (versionsMatch && method === "POST") return await definitionRoutes.handleCreateDraftVersion(ctx, versionsMatch[1]!);

      const publishMatch = url.pathname.match(VERSION_PUBLISH_PATTERN);
      if (publishMatch && method === "POST") return await definitionRoutes.handlePublishVersion(ctx, publishMatch[1]!);

      const retireMatch = url.pathname.match(VERSION_RETIRE_PATTERN);
      if (retireMatch && method === "POST") return await definitionRoutes.handleRetireVersion(ctx, retireMatch[1]!);

      const stepMatch = url.pathname.match(VERSION_STEP_PATTERN);
      if (stepMatch) {
        if (method === "PATCH") return await definitionRoutes.handleUpdateStep(ctx, stepMatch[1]!, stepMatch[2]!);
        if (method === "DELETE") return await definitionRoutes.handleDeleteStep(ctx, stepMatch[1]!, stepMatch[2]!);
        return sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.", correlationId);
      }

      const stepsMatch = url.pathname.match(VERSION_STEPS_PATTERN);
      if (stepsMatch && method === "POST") return await definitionRoutes.handleAddStep(ctx, stepsMatch[1]!);

      const versionMatch = url.pathname.match(VERSION_PATTERN);
      if (versionMatch && method === "GET") return await definitionRoutes.handleGetVersion(ctx, versionMatch[1]!);

      const definitionMatch = url.pathname.match(DEFINITION_PATTERN);
      if (definitionMatch && method === "GET") return await definitionRoutes.handleGetDefinition(ctx, definitionMatch[1]!);

      const historyMatch = url.pathname.match(INSTANCE_HISTORY_PATTERN);
      if (historyMatch && method === "GET") return await instanceRoutes.handleGetInstanceHistory(ctx, historyMatch[1]!);

      const cancelMatch = url.pathname.match(INSTANCE_CANCEL_PATTERN);
      if (cancelMatch && method === "POST") return await instanceRoutes.handleCancelInstance(ctx, cancelMatch[1]!);

      const instanceMatch = url.pathname.match(INSTANCE_PATTERN);
      if (instanceMatch && method === "GET") return await instanceRoutes.handleGetInstance(ctx, instanceMatch[1]!);

      const decideMatch = url.pathname.match(TASK_DECIDE_PATTERN);
      if (decideMatch && method === "POST") return await taskRoutes.handleDecideTask(ctx, decideMatch[1]!);

      const completeMatch = url.pathname.match(TASK_COMPLETE_PATTERN);
      if (completeMatch && method === "POST") return await taskRoutes.handleCompleteTask(ctx, completeMatch[1]!);

      const reassignMatch = url.pathname.match(TASK_REASSIGN_PATTERN);
      if (reassignMatch && method === "POST") return await taskRoutes.handleReassignTask(ctx, reassignMatch[1]!);

      const taskMatch = url.pathname.match(TASK_PATTERN);
      if (taskMatch && method === "GET") return await taskRoutes.handleGetTask(ctx, taskMatch[1]!);

      return sendError(res, 404, "NOT_FOUND", "Not found.", correlationId);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Unhandled error", { correlationId, message: (error as Error)?.message });
      return sendError(res, 500, "INTERNAL_ERROR", "An unexpected error occurred.", correlationId);
    }
  });
}
