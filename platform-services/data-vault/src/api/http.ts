/**
 * Minimal HTTP server for /api/v1/data-vault — no framework, same
 * convention as platform-services/identity/src/api/http.ts (see that
 * file's header comment for the rationale). This server is Data Vault's
 * own; it does not mount into, or get mounted by, Identity's server.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { DataVaultContainer } from "../composition/container.ts";
import { getOrCreateCorrelationId, sendError } from "../../../identity/src/api/middleware/envelope.ts";
import * as dataVaultRoutes from "./routes/dataVault.ts";

type Handler = (ctx: { req: IncomingMessage; res: ServerResponse; container: DataVaultContainer; correlationId: string }) => Promise<void>;

const STATIC_ROUTES: Record<string, Record<string, Handler>> = {
  "/api/v1/data-vault/records": { GET: dataVaultRoutes.handleListRecords, POST: dataVaultRoutes.handleCreateRecord },
  "/api/v1/data-vault/legal-entities": { GET: dataVaultRoutes.handleListLegalEntities },
};

const RECORD_PATTERN = /^\/api\/v1\/data-vault\/records\/([^/]+)$/;
const ARCHIVE_PATTERN = /^\/api\/v1\/data-vault\/records\/([^/]+)\/archive$/;

export function createHttpServer(container: DataVaultContainer) {
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

      const archiveMatch = url.pathname.match(ARCHIVE_PATTERN);
      if (archiveMatch && method === "POST") {
        return await dataVaultRoutes.handleArchiveRecord({ req, res, container, correlationId }, archiveMatch[1]!);
      }

      const recordMatch = url.pathname.match(RECORD_PATTERN);
      if (recordMatch) {
        if (method === "GET") return await dataVaultRoutes.handleGetRecord({ req, res, container, correlationId }, recordMatch[1]!);
        if (method === "PATCH") return await dataVaultRoutes.handleUpdateRecord({ req, res, container, correlationId }, recordMatch[1]!);
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
