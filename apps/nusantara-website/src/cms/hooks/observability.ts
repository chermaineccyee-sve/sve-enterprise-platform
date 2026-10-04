import type { AfterErrorHook, CollectionAfterLoginHook, CollectionAfterLogoutHook } from "payload";
import { isDbConnectionError, logEvent } from "../log";

/**
 * Failed Admin Portal / CMS API requests, classified so they can be found in
 * the logs: database connectivity, media uploads, authentication (failed
 * login, lock-out, refused account creation) and everything else.
 */
export const logCmsError: AfterErrorHook = ({ error, req, collection, result }) => {
  const status = (error as { status?: number }).status ?? (result as { status?: number } | undefined)?.status ?? 500;
  const base = {
    method: req?.method,
    path: req?.url ? new URL(req.url).pathname : undefined,
    collection: collection?.slug,
    status,
    userId: req?.user?.id,
    error,
  };
  // Classified by route, status and message: production builds minify error class names.
  const isLogin = !!base.path?.endsWith("/login") && collection?.slug === "users";
  if (isDbConnectionError(error)) logEvent("error", "cms.db.unreachable", base);
  else if (isLogin && /locked/i.test(error?.message ?? "")) logEvent("warn", "auth.locked", base);
  else if (isLogin && status === 401) logEvent("warn", "auth.login_failed", base);
  else if (collection?.slug === "users" && status === 403 && !req?.user) logEvent("warn", "auth.refused", base);
  else if (collection?.upload) logEvent(status >= 500 ? "error" : "warn", "media.request_failed", base);
  else if (status >= 500) logEvent("error", "cms.request.failed", base);
  else if (status === 401 || status === 403) logEvent("info", "cms.request.denied", base);
};

export const logLogin: CollectionAfterLoginHook = ({ user, req }) => {
  logEvent("info", "auth.login", { userId: user?.id, role: (user as { role?: string })?.role, ip: req?.headers?.get("x-nf-client-connection-ip") ?? undefined });
};

export const logLogout: CollectionAfterLogoutHook = ({ req }) => {
  logEvent("info", "auth.logout", { userId: req?.user?.id });
};
