/* Admin Portal REST API (Payload), at /api/cms. Separate from the site's own /api routes. */
import config from "@payload-config";
import { REST_DELETE, REST_GET, REST_OPTIONS, REST_PATCH, REST_POST, REST_PUT } from "@payloadcms/next/routes";

const restPost = REST_POST(config);

/**
 * Version restores (POST /api/cms/{collection}/versions/{id}) are always
 * requested as drafts, so a restore produces a Draft working copy that goes
 * through review instead of replacing or unpublishing the live version. The
 * collections also refuse non-draft restores themselves (src/cms/hooks/workflow.ts).
 */
export async function POST(request: Request, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  if (slug.length === 3 && slug[1] === "versions") {
    const url = new URL(request.url);
    url.searchParams.set("draft", "true");
    const headers = new Headers(request.headers);
    return restPost(new Request(url, { method: "POST", headers, body: await request.arrayBuffer() }), context);
  }
  return restPost(request, context);
}

export const GET = REST_GET(config);
export const DELETE = REST_DELETE(config);
export const PATCH = REST_PATCH(config);
export const PUT = REST_PUT(config);
export const OPTIONS = REST_OPTIONS(config);
