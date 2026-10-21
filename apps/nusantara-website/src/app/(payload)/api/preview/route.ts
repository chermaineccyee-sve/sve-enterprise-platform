import config from "@payload-config";
import { cookies, draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { getPayload } from "payload";
import { roleOf } from "@/cms/access/roles";
import { PREVIEWABLE, publicPathFor, type PreviewableCollection } from "@/cms/preview";
import { PREVIEW_COOKIE } from "@/lib/content/preview-session";

/**
 * Admin Portal → website preview: /api/preview?collection=…&id=…
 *
 * Requires a signed-in Admin Portal user (the Payload session cookie). It
 * enables Next.js Draft Mode for this browser, records which item to preview,
 * and redirects to the page where that item appears, computed from the stored
 * document (never from the request). Every preview render re-checks the
 * session (src/lib/content/preview-session.ts).
 */
export const dynamic = "force-dynamic";

const deny = (status: number, message: string) =>
  new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

export async function GET(request: Request) {
  if (process.env.CONTENT_SOURCE !== "cms") return deny(409, "Preview needs the CMS content source (CONTENT_SOURCE=cms).");
  const url = new URL(request.url);
  const collection = url.searchParams.get("collection") ?? "";
  const id = Number(url.searchParams.get("id"));
  if (!(PREVIEWABLE as readonly string[]).includes(collection) || !Number.isInteger(id) || id <= 0) return deny(400, "Unknown preview target.");

  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: request.headers }).catch(() => ({ user: null }));
  if (!user || !roleOf({ user: user as never })) return deny(401, "Sign in to the Admin Portal to preview unpublished content.");

  const doc = await payload
    .findByID({ collection: collection as PreviewableCollection, id, draft: true, depth: 0, user, overrideAccess: false })
    .catch(() => null);
  const path = doc ? publicPathFor(collection, doc as unknown as Record<string, unknown>) : null;
  if (!path) return deny(404, "This item has no public page to preview.");

  (await draftMode()).enable();
  (await cookies()).set(PREVIEW_COOKIE, `${collection}:${id}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  redirect(path);
}
