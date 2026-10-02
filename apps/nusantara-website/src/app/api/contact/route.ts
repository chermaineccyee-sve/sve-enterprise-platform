import { validateEnquiry, type EnquiryInput } from "@/lib/contact";

/**
 * Prototype enquiry endpoint. Validates input server-side and acknowledges
 * receipt, but deliberately does NOT store or transmit the enquiry. Connect
 * to an approved CRM / mail service before publication.
 */
export async function POST(req: Request) {
  let body: EnquiryInput;
  try {
    body = (await req.json()) as EnquiryInput;
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  if (body.website) {
    // Honeypot filled: respond as if accepted, do nothing.
    return Response.json({ ok: true, prototype: true }, { status: 202 });
  }
  const errors = validateEnquiry(body);
  if (Object.keys(errors).length) {
    return Response.json({ ok: false, errors }, { status: 422 });
  }
  return Response.json({ ok: true, prototype: true }, { status: 202 });
}
