/**
 * Minimal HTTP server for /api/v1/hrms/lifecycle — no framework, same
 * convention as platform-services/identity's and platform-services/
 * organisation's src/api/http.ts. Only routes justified by this
 * foundation exist — no Payroll/Leave/Attendance/Performance routes.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { HrmsContainer } from "../composition/container.ts";
import { getOrCreateCorrelationId, sendError } from "../../../identity/src/api/middleware/envelope.ts";
import * as lifecycleRoutes from "./routes/lifecycle.ts";

type Handler = (ctx: { req: IncomingMessage; res: ServerResponse; container: HrmsContainer; correlationId: string }) => Promise<void>;

const STATIC_ROUTES: Record<string, Record<string, Handler>> = {
  "/api/v1/hrms/lifecycle/cases": { GET: lifecycleRoutes.handleListCases, POST: lifecycleRoutes.handleCreateCase },
};

const CASE_PATTERN = /^\/api\/v1\/hrms\/lifecycle\/cases\/([^/]+)$/;
const COMPLETE_PATTERN = /^\/api\/v1\/hrms\/lifecycle\/cases\/([^/]+)\/complete$/;
const CANCEL_PATTERN = /^\/api\/v1\/hrms\/lifecycle\/cases\/([^/]+)\/cancel$/;
const EVENTS_PATTERN = /^\/api\/v1\/hrms\/lifecycle\/cases\/([^/]+)\/events$/;
const MILESTONES_PATTERN = /^\/api\/v1\/hrms\/lifecycle\/cases\/([^/]+)\/milestones$/;
const MILESTONE_PATTERN = /^\/api\/v1\/hrms\/lifecycle\/cases\/([^/]+)\/milestones\/([^/]+)$/;
const PROBATION_REVIEWS_PATTERN = /^\/api\/v1\/hrms\/lifecycle\/cases\/([^/]+)\/probation-reviews$/;
const PROBATION_DECISION_PATTERN = /^\/api\/v1\/hrms\/lifecycle\/cases\/([^/]+)\/probation-decision$/;
const EMPLOYMENT_CHANGE_COMPLETE_PATTERN = /^\/api\/v1\/hrms\/lifecycle\/cases\/([^/]+)\/employment-change\/complete$/;
const OFFBOARDING_COMPLETE_PATTERN = /^\/api\/v1\/hrms\/lifecycle\/cases\/([^/]+)\/offboarding\/complete$/;

export function createHttpServer(container: HrmsContainer) {
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

      const completeMatch = url.pathname.match(COMPLETE_PATTERN);
      if (completeMatch && method === "POST") return await lifecycleRoutes.handleCompleteCase(ctx, completeMatch[1]!);

      const cancelMatch = url.pathname.match(CANCEL_PATTERN);
      if (cancelMatch && method === "POST") return await lifecycleRoutes.handleCancelCase(ctx, cancelMatch[1]!);

      const eventsMatch = url.pathname.match(EVENTS_PATTERN);
      if (eventsMatch && method === "GET") return await lifecycleRoutes.handleListEvents(ctx, eventsMatch[1]!);

      const milestoneMatch = url.pathname.match(MILESTONE_PATTERN);
      if (milestoneMatch) {
        if (method === "PATCH") return await lifecycleRoutes.handleUpdateMilestone(ctx, milestoneMatch[1]!, milestoneMatch[2]!);
        return sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.", correlationId);
      }

      const milestonesMatch = url.pathname.match(MILESTONES_PATTERN);
      if (milestonesMatch) {
        if (method === "GET") return await lifecycleRoutes.handleListMilestones(ctx, milestonesMatch[1]!);
        if (method === "POST") return await lifecycleRoutes.handleAddMilestone(ctx, milestonesMatch[1]!);
        return sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.", correlationId);
      }

      const probationDecisionMatch = url.pathname.match(PROBATION_DECISION_PATTERN);
      if (probationDecisionMatch && method === "POST") return await lifecycleRoutes.handleRecordProbationDecision(ctx, probationDecisionMatch[1]!);

      const probationReviewsMatch = url.pathname.match(PROBATION_REVIEWS_PATTERN);
      if (probationReviewsMatch && method === "GET") return await lifecycleRoutes.handleListProbationReviews(ctx, probationReviewsMatch[1]!);

      const employmentChangeMatch = url.pathname.match(EMPLOYMENT_CHANGE_COMPLETE_PATTERN);
      if (employmentChangeMatch && method === "POST") return await lifecycleRoutes.handleCompleteEmploymentChange(ctx, employmentChangeMatch[1]!);

      const offboardingMatch = url.pathname.match(OFFBOARDING_COMPLETE_PATTERN);
      if (offboardingMatch && method === "POST") return await lifecycleRoutes.handleCompleteOffboarding(ctx, offboardingMatch[1]!);

      const caseMatch = url.pathname.match(CASE_PATTERN);
      if (caseMatch) {
        if (method === "GET") return await lifecycleRoutes.handleGetCase(ctx, caseMatch[1]!);
        return sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.", correlationId);
      }

      return sendError(res, 404, "NOT_FOUND", "Not found.", correlationId);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Unhandled error", { correlationId, message: (error as Error)?.message });
      return sendError(res, 500, "INTERNAL_ERROR", "An unexpected error occurred.", correlationId);
    }
  });
}
