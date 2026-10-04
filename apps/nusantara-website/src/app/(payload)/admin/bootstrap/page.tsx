import type { Metadata } from "next";
import { BootstrapForm } from "@/cms/admin/BootstrapForm";

/** First-Admin bootstrap window (src/cms/bootstrap.ts). Overrides Payload's catch-all for this path. */
export const metadata: Metadata = { title: "Set up the first Admin · Nusantara Administration", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Bootstrap({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  return <BootstrapForm state={state} />;
}
