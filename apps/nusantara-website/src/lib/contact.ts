/** Shared enquiry schema and validation — used by the form and by the API route. */
export const ENQUIRY_TOPICS = [
  { id: "general", label: "General Enquiries", text: "Questions about Nusantara and this website." },
  { id: "institutional", label: "Institutional Enquiries", text: "For institutions, family offices and professional investors." },
  { id: "research", label: "Market Insights / Research", text: "About our research, the Market Dashboard or Nusantara View." },
  { id: "business", label: "Business Enquiries", text: "Partnerships, media and other business matters." },
] as const;
export type EnquiryTopic = (typeof ENQUIRY_TOPICS)[number]["id"];

/** What the browser submits. */
export type EnquiryInput = {
  topic: string;
  name: string;
  email: string;
  organisation?: string;
  /** Optional. Supported by the schema; the current form does not ask for it. */
  telephone?: string;
  message: string;
  consent: boolean;
  /** Honeypot; must be empty. */
  website?: string;
};

/**
 * Delivery outcome:
 *  - not-configured: validated, then deliberately neither stored nor sent (prototype)
 *  - delivered:      accepted by the configured delivery service
 *  - failed:         the configured service did not accept it
 */
export type SubmissionStatus = "not-configured" | "delivered" | "failed";

/** The record a delivery service receives. */
export type EnquirySubmission = {
  id: string;
  topic: EnquiryTopic;
  name: string;
  organisation: string | null;
  email: string;
  telephone: string | null;
  message: string;
  consent: true;
  /** ISO timestamp, set by the server. */
  submittedAt: string;
  status: SubmissionStatus;
};

export type EnquiryErrors = Partial<Record<"topic" | "name" | "email" | "organisation" | "telephone" | "message" | "consent", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEPHONE = /^\+?[0-9 ()-]{6,24}$/;

export function validateEnquiry(v: EnquiryInput): EnquiryErrors {
  const e: EnquiryErrors = {};
  if (!ENQUIRY_TOPICS.some((t) => t.id === v.topic)) e.topic = "Select the type of enquiry.";
  if (!v.name || v.name.trim().length < 2) e.name = "Enter your full name.";
  else if (v.name.length > 120) e.name = "Name must be 120 characters or fewer.";
  if (!v.email || !EMAIL.test(v.email.trim()) || v.email.length > 254) e.email = "Enter a valid email address, for example name@organisation.com.";
  if (v.organisation && v.organisation.length > 160) e.organisation = "Organisation must be 160 characters or fewer.";
  if (v.telephone && !TELEPHONE.test(v.telephone.trim())) e.telephone = "Enter a valid telephone number, or leave it blank.";
  const len = (v.message ?? "").trim().length;
  if (len < 20) e.message = "Tell us a little more — at least 20 characters.";
  else if (len > 2000) e.message = "Message must be 2,000 characters or fewer.";
  if (v.consent !== true) e.consent = "Confirm that you have read the privacy notice.";
  return e;
}

/** Normalises validated input into a submission record (server side). */
export function toSubmission(v: EnquiryInput, id: string, submittedAt: string): EnquirySubmission {
  const clean = (s?: string) => (s && s.trim() ? s.trim() : null);
  return {
    id,
    topic: v.topic as EnquiryTopic,
    name: v.name.trim(),
    organisation: clean(v.organisation),
    email: v.email.trim(),
    telephone: clean(v.telephone),
    message: v.message.trim(),
    consent: true,
    submittedAt,
    status: "not-configured",
  };
}
