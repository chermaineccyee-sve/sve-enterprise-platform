import type { Metadata } from "next";
import { ForgotUnavailable } from "@/cms/admin/ForgotUnavailable";

/** Overrides Payload's /admin/forgot while email password reset is not configured. */
export const metadata: Metadata = { title: "Password reset · Nusantara Administration", robots: { index: false, follow: false } };

export default function Forgot() {
  return <ForgotUnavailable />;
}
