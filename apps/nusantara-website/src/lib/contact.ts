/** Shared enquiry validation — used by the form and by the API route. */
export const ENQUIRY_TOPICS = [
  { id: "general", label: "General Enquiries", text: "Questions about Nusantara and this website." },
  { id: "institutional", label: "Institutional Enquiries", text: "For institutions, family offices and professional investors." },
  { id: "research", label: "Market Insights / Research", text: "About our research, the Market Dashboard or Nusantara View." },
  { id: "business", label: "Business Enquiries", text: "Partnerships, media and other business matters." },
] as const;
export type EnquiryTopic = (typeof ENQUIRY_TOPICS)[number]["id"];

export type EnquiryInput = {
  topic: string;
  name: string;
  email: string;
  organisation?: string;
  message: string;
  consent: boolean;
  /** Honeypot; must be empty. */
  website?: string;
};

export type EnquiryErrors = Partial<Record<"topic" | "name" | "email" | "message" | "consent", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEnquiry(v: EnquiryInput): EnquiryErrors {
  const e: EnquiryErrors = {};
  if (!ENQUIRY_TOPICS.some((t) => t.id === v.topic)) e.topic = "Select the type of enquiry.";
  if (!v.name || v.name.trim().length < 2) e.name = "Enter your full name.";
  else if (v.name.length > 120) e.name = "Name must be 120 characters or fewer.";
  if (!v.email || !EMAIL.test(v.email.trim())) e.email = "Enter a valid email address, for example name@organisation.com.";
  const len = (v.message ?? "").trim().length;
  if (len < 20) e.message = "Tell us a little more — at least 20 characters.";
  else if (len > 2000) e.message = "Message must be 2,000 characters or fewer.";
  if (!v.consent) e.consent = "Confirm that you have read the privacy notice.";
  return e;
}
