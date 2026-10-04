import type { MetadataRoute } from "next";
import { config } from "@/lib/config";
import { site } from "@/lib/site";

/**
 * Indexing follows the environment (src/lib/config.ts): prototype and staging
 * are excluded entirely; production is indexed only when management has
 * decided so (SITE_INDEXING=allow).
 */
export default function robots(): MetadataRoute.Robots {
  if (config.indexing !== "allow") return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] }, sitemap: `${site.url}/sitemap.xml` };
}
