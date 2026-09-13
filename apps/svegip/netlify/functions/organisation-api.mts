/**
 * Authenticated proxy to platform-services/organisation's HTTP API — the
 * Employee Master / Employee Directory / org-structure reference data
 * consumed by the People/HRMS area. See ./_platform-proxy.mts for the
 * full contract.
 */
import type { Context, Config } from "@netlify/functions";
import { proxyToPlatformService } from "./_platform-proxy.mts";

export default async (req: Request, _context: Context) => proxyToPlatformService(req, "SVE_ORGANISATION_API_BASE", "http://localhost:4003");

export const config: Config = { path: ["/api/v1/organisation/*", "/api/v1/employees", "/api/v1/employees/*"] };
