import "server-only";
import { createHmac } from "node:crypto";
import type { EnquirySubmission, SubmissionStatus } from "./contact";

/**
 * ENQUIRY DELIVERY — the seam where an approved submission service connects.
 *
 *   CONTACT_DELIVERY=none     (default) validate only; nothing stored or sent
 *   CONTACT_DELIVERY=webhook  POST the submission as JSON to CONTACT_WEBHOOK_URL,
 *                             signed with HMAC-SHA256 (CONTACT_WEBHOOK_SECRET)
 *                             in the X-Nusantara-Signature header
 *
 * A CRM, ticketing or mail service is connected by pointing the webhook at it
 * (or at a small relay), or by adding an adapter here. The form and API route
 * do not change. Secrets are server-side only.
 */

export type DeliveryMode = "none" | "webhook";

export function deliveryMode(): DeliveryMode {
  return process.env.CONTACT_DELIVERY === "webhook" && process.env.CONTACT_WEBHOOK_URL && process.env.CONTACT_WEBHOOK_SECRET ? "webhook" : "none";
}

export async function deliverEnquiry(submission: EnquirySubmission): Promise<SubmissionStatus> {
  if (deliveryMode() === "none") return "not-configured";
  const url = process.env.CONTACT_WEBHOOK_URL!;
  const body = JSON.stringify({ ...submission, status: "delivered" });
  const signature = createHmac("sha256", process.env.CONTACT_WEBHOOK_SECRET!).update(body).digest("hex");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Nusantara-Signature": `sha256=${signature}` },
      body,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    return res.ok ? "delivered" : "failed";
  } catch {
    return "failed";
  }
}
