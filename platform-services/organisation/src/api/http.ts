/**
 * Minimal HTTP server for /api/v1/organisation and /api/v1/employees — no
 * framework, same convention as platform-services/identity/src/api/http.ts.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { OrganisationContainer } from "../composition/container.ts";
import { getOrCreateCorrelationId, sendError } from "../../../identity/src/api/middleware/envelope.ts";
import * as orgRoutes from "./routes/organisation.ts";
import * as employeeRoutes from "./routes/employees.ts";

type Handler = (ctx: { req: IncomingMessage; res: ServerResponse; container: OrganisationContainer; correlationId: string }) => Promise<void>;

const STATIC_ROUTES: Record<string, Record<string, Handler>> = {
  "/api/v1/organisation/legal-entities": { GET: orgRoutes.handleListLegalEntities },
  "/api/v1/organisation/business-units": { GET: orgRoutes.handleListBusinessUnits, POST: orgRoutes.handleCreateBusinessUnit },
  "/api/v1/organisation/departments": { GET: orgRoutes.handleListDepartments, POST: orgRoutes.handleCreateDepartment },
  "/api/v1/organisation/positions": { GET: orgRoutes.handleListPositions, POST: orgRoutes.handleCreatePosition },
  "/api/v1/employees": { GET: employeeRoutes.handleListEmployees, POST: employeeRoutes.handleCreateEmployee },
  // Checked as an exact-match static route BEFORE EMPLOYEE_PATTERN below,
  // so "me" can never be interpreted as an :id path segment (PR #11).
  "/api/v1/employees/me": { GET: employeeRoutes.handleGetMyEmployee },
};

const EMPLOYEE_PATTERN = /^\/api\/v1\/employees\/([^/]+)$/;
const ASSIGNMENTS_PATTERN = /^\/api\/v1\/employees\/([^/]+)\/assignments$/;
const END_ASSIGNMENT_PATTERN = /^\/api\/v1\/employees\/([^/]+)\/end-assignment$/;
const LINK_IDENTITY_PATTERN = /^\/api\/v1\/employees\/([^/]+)\/link-identity$/;
const UNLINK_IDENTITY_PATTERN = /^\/api\/v1\/employees\/([^/]+)\/unlink-identity$/;

export function createHttpServer(container: OrganisationContainer) {
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

      const assignmentsMatch = url.pathname.match(ASSIGNMENTS_PATTERN);
      if (assignmentsMatch) {
        if (method === "GET") return await employeeRoutes.handleListAssignments(ctx, assignmentsMatch[1]!);
        if (method === "POST") return await employeeRoutes.handleCreateAssignment(ctx, assignmentsMatch[1]!);
        return sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.", correlationId);
      }

      const endMatch = url.pathname.match(END_ASSIGNMENT_PATTERN);
      if (endMatch && method === "POST") return await employeeRoutes.handleEndAssignment(ctx, endMatch[1]!);

      const linkMatch = url.pathname.match(LINK_IDENTITY_PATTERN);
      if (linkMatch && method === "POST") return await employeeRoutes.handleLinkIdentity(ctx, linkMatch[1]!);

      const unlinkMatch = url.pathname.match(UNLINK_IDENTITY_PATTERN);
      if (unlinkMatch && method === "POST") return await employeeRoutes.handleUnlinkIdentity(ctx, unlinkMatch[1]!);

      const employeeMatch = url.pathname.match(EMPLOYEE_PATTERN);
      if (employeeMatch) {
        if (method === "GET") return await employeeRoutes.handleGetEmployee(ctx, employeeMatch[1]!);
        if (method === "PATCH") return await employeeRoutes.handleUpdateEmployee(ctx, employeeMatch[1]!);
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
