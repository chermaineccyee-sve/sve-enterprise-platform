/**
 * The /api/v1 response envelope from docs/architecture/api-conventions.md,
 * plus correlation-ID handling. Every route handler uses these — nothing
 * writes a raw response shape by hand.
 */
import { randomUUID } from "node:crypto";
import type { ServerResponse, IncomingMessage } from "node:http";
import type { ApiErrorBody, ApiSuccess } from "../../../../../packages/types/src/api.ts";

export function getOrCreateCorrelationId(req: IncomingMessage): string {
  const header = req.headers["x-correlation-id"];
  if (typeof header === "string" && header.length > 0 && header.length <= 128) return header;
  return randomUUID();
}

export function sendJson(res: ServerResponse, status: number, body: unknown, correlationId: string): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "x-correlation-id": correlationId,
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

export function sendSuccess<T>(res: ServerResponse, status: number, data: T, correlationId: string, pagination?: { cursor?: string; nextCursor?: string; limit: number }): void {
  const body: ApiSuccess<T> = { data, meta: { correlationId, ...(pagination && { pagination }) } };
  sendJson(res, status, body, correlationId);
}

export function sendError(res: ServerResponse, status: number, code: string, message: string, correlationId: string): void {
  const body: ApiErrorBody = { error: { code, message }, meta: { correlationId } };
  sendJson(res, status, body, correlationId);
}

export async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("Invalid JSON body.");
  }
}
