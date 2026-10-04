import type { Metadata } from "next";
import { config } from "@/lib/config";
import { site } from "@/lib/site";

/** Site-wide metadata for the public site's root layout (and its global 404). */
export const siteMetadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — Investing with Perspective`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: site.name,
    title: `${site.name} — Investing with Perspective`,
    description: site.description,
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image" },
  // Indexing follows the environment; production only once management decides (src/lib/config.ts).
  robots: config.indexing === "allow" ? { index: true, follow: true } : { index: false, follow: false },
} satisfies Metadata;
