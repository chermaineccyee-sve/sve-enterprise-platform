import type { Access, FieldAccess, PayloadRequest } from "payload";

/**
 * Admin Portal roles. Every check here runs on the server, in Payload's
 * access layer, for the Admin UI, the REST API and the Local API alike.
 *
 *  editor   — creates and edits content, submits it for review. Cannot approve or publish.
 *  reviewer — reviews, approves and publishes (never their own work where
 *             separation applies — see ../hooks/workflow.ts). Cannot manage users.
 *  admin    — everything a reviewer can do, plus users, site settings and
 *             confirming content as Approved Corporate Content.
 *
 * Roles are stored on the user record, not in the identity provider, so a
 * corporate SSO/MFA strategy can be added later without changing this model.
 */
export const ROLES = ["editor", "reviewer", "admin"] as const;
export type Role = (typeof ROLES)[number];

type UserLike = { id: number | string; role?: Role | null; email?: string; name?: string | null } | null | undefined;

export const roleOf = (req: Pick<PayloadRequest, "user"> | { user?: UserLike }): Role | null => {
  const u = req.user as UserLike;
  return u && u.role && (ROLES as readonly string[]).includes(u.role) ? u.role : null;
};

export const hasRole = (req: Pick<PayloadRequest, "user">, ...roles: Role[]) => {
  const r = roleOf(req);
  return !!r && roles.includes(r);
};

export const isStaff = (req: Pick<PayloadRequest, "user">) => roleOf(req) !== null;
export const canApprove = (req: Pick<PayloadRequest, "user">) => hasRole(req, "reviewer", "admin");

/* Collection-level access ------------------------------------------------- */

export const signedIn: Access = ({ req }) => isStaff(req);
export const editors: Access = ({ req }) => isStaff(req);
export const approvers: Access = ({ req }) => canApprove(req);
export const adminsOnly: Access = ({ req }) => hasRole(req, "admin");
export const nobody: Access = () => false;

/* Field-level access ------------------------------------------------------ */

export const adminField: FieldAccess = ({ req }) => hasRole(req, "admin");
export const approverField: FieldAccess = ({ req }) => canApprove(req);
