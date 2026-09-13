/**
 * Authenticated proxy to platform-services/hrms's HTTP API — the HR
 * lifecycle (onboarding/probation/employment-change/offboarding) data
 * consumed by the People/HRMS area. See ./_platform-proxy.mts for the
 * full contract.
 */
import type { Context, Config } from "@netlify/functions";
import { proxyToPlatformService } from "./_platform-proxy.mts";

export default async (req: Request, _context: Context) => proxyToPlatformService(req, "SVE_HRMS_API_BASE", "http://localhost:4004");

export const config: Config = { path: "/api/v1/hrms/*" };
