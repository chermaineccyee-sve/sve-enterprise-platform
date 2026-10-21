import { randomUUID } from "node:crypto";
import { toSubmission, validateEnquiry, type EnquiryInput } from "@/lib/contact";
import { deliverEnquiry } from "@/lib/contact-delivery";
import { rateLimit } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 8 * 1024;

/**
 * Enquiry endpoint. Validates input server-side and hands a normalised
 * submission to the configured delivery service. In the prototype no service
 * is configured: the enquiry is validated, then neither stored nor sent.
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const limit = rateLimit(`contact:${ip}`, { limit: 5, windowMs: 10 * 60_000 });
  if (!limit.ok) {
    return Response.json({ ok: false, error: "Too many enquiries. Please try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterS) } });
  }
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 415 });
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return Response.json({ ok: false, error: "Request too large." }, { status: 413 });

  let body: EnquiryInput;
  try {
    body = JSON.parse(raw) as EnquiryInput;
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  if (body.website) {
    // Honeypot filled: respond as if accepted, do nothing.
    return Response.json({ ok: true, status: "not-configured" }, { status: 202 });
  }
  const errors = validateEnquiry(body);
  if (Object.keys(errors).length) {
    return Response.json({ ok: false, errors }, { status: 422 });
  }
  const submission = toSubmission(body, randomUUID(), new Date().toISOString());
  const status = await deliverEnquiry(submission);
  if (status === "failed") {
    return Response.json({ ok: false, status, error: "Your enquiry could not be sent. Please try again later." }, { status: 502 });
  }
  return Response.json({ ok: true, status, submittedAt: submission.submittedAt }, { status: 202 });
}
