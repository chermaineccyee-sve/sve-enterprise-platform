import type { Metadata } from "next";
import { CTA } from "@/components/ui/CTA";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <section className="bg-ivory">
      <div className="container-site py-28 md:py-40">
        <p className="eyebrow text-stone">404</p>
        <h1 className="display-l mt-6 max-w-3xl text-teal-900">This page could not be found.</h1>
        <p className="lede mt-6 max-w-xl text-stone">The page may have moved, or the address may be incorrect.</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <CTA href="/">Return home</CTA>
          <CTA href="/insights" variant="secondary">
            Browse insights
          </CTA>
        </div>
      </div>
    </section>
  );
}
