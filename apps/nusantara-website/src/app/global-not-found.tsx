import type { Metadata } from "next";
import { site } from "@/lib/site";
import SiteLayout, { viewport as siteViewport } from "./(site)/layout";
import { siteMetadata } from "./(site)/metadata";
import NotFound from "./(site)/not-found";

/**
 * 404 for URLs that match no route. The app has two root layouts — the public
 * site, app/(site), and the Admin Portal, app/(payload) — so Next.js cannot
 * compose this page from a single root layout. It renders the public site's
 * own layout and 404 page, so unmatched URLs look exactly as before.
 * notFound() inside the site (e.g. an unknown article) still uses
 * app/(site)/not-found.tsx directly.
 */
export const metadata: Metadata = { ...siteMetadata, title: `Page not found | ${site.name}` };
export const viewport = siteViewport;

export default function GlobalNotFound() {
  return (
    <SiteLayout>
      <NotFound />
    </SiteLayout>
  );
}
