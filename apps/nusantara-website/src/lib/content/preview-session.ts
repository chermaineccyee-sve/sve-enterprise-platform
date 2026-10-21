import "server-only";
import { cookies, draftMode, headers } from "next/headers";
import { cache } from "react";
import { contentSource } from "./source";

/**
 * Preview access, checked on EVERY request. A preview shows unpublished
 * content only when all of these hold:
 *  - the site reads the CMS (CONTENT_SOURCE=cms);
 *  - Next.js Draft Mode is on for this browser (set only by /api/preview after
 *    it has verified an Admin Portal session);
 *  - the request still carries a valid Admin Portal session with a role;
 *  - the preview cookie names a previewable item.
 * Otherwise the visitor sees the live site. Draft Mode responses are never
 * cached (Cache-Control: private, no-store) and pages are noindex.
 */
export const PREVIEW_COOKIE = "nusantara-preview";
const PREVIEWABLE = ["insights", "nusantaraViews", "marketStateEditions", "signals", "themes", "capabilities"] as const;
export type PreviewTarget = { collection: (typeof PREVIEWABLE)[number]; id: number };

export const getPreviewTarget = cache(async (): Promise<PreviewTarget | null> => {
  if (contentSource !== "cms") return null;
  // Build-time reads (generateStaticParams, sitemap) have no request and are never previews.
  let enabled = false;
  try {
    enabled = (await draftMode()).isEnabled;
  } catch {
    return null;
  }
  if (!enabled) return null;
  const [collection, rawId] = ((await cookies()).get(PREVIEW_COOKIE)?.value ?? "").split(":");
  const id = Number(rawId);
  if (!(PREVIEWABLE as readonly string[]).includes(collection) || !Number.isInteger(id) || id <= 0) return null;
  const [{ getPayload }, { default: config }, { roleOf }] = await Promise.all([import("payload"), import("@payload-config"), import("@/cms/access/roles")]);
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await headers() }).catch(() => ({ user: null }));
  if (!user || !roleOf({ user: user as never })) return null;
  return { collection: collection as PreviewTarget["collection"], id };
});
