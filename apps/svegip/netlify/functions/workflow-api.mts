/**
 * Authenticated proxy to platform-services/workflow's HTTP API — the
 * task/approval data consumed by the My Tasks / Approvals area. See
 * ./_platform-proxy.mts for the full contract.
 */
import type { Context, Config } from "@netlify/functions";
import { proxyToPlatformService } from "./_platform-proxy.mts";

export default async (req: Request, _context: Context) => proxyToPlatformService(req, "SVE_WORKFLOW_API_BASE", "http://localhost:4005");

export const config: Config = { path: "/api/v1/workflow/*" };
