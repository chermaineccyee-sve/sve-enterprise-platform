import { APIError, type CollectionConfig } from "payload";
import { adminField, adminsOnly, hasRole, ROLES, signedIn } from "../access/roles";
import { auditUserChange } from "../hooks/audit";

const MIN_PASSWORD = 12;
const isProd = process.env.NODE_ENV === "production";

/**
 * USERS — Admin Portal accounts, with Payload's server-side password
 * authentication: salted PBKDF2 hashes, HTTP-only session cookie, CSRF origin
 * checks, login throttling and lock-out, session expiry, logout.
 *
 * No self-registration. The very first account can only be created when
 * CMS_ALLOW_FIRST_USER=true (or by the server-side seed script); afterwards
 * only an Admin creates accounts and assigns roles.
 *
 * SSO/MFA later: Payload auth strategies (auth.strategies) can authenticate
 * against a corporate identity provider and resolve to these same user
 * records by email; roles stay here. Local passwords can then be disabled
 * (auth.disableLocalStrategy) without touching any content collection.
 */
export const Users: CollectionConfig = {
  slug: "users",
  admin: { group: "Administration", useAsTitle: "email", defaultColumns: ["email", "name", "role"] },
  auth: {
    tokenExpiration: 60 * 60 * 8, // 8 hours
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000, // 15 minutes
    useSessions: true,
    cookies: { secure: isProd, sameSite: "Strict" },
  },
  access: {
    read: signedIn,
    update: ({ req, id }) => hasRole(req, "admin") || (!!req.user && String(req.user.id) === String(id)),
    delete: adminsOnly,
    create: async ({ req }) => {
      if (hasRole(req, "admin")) return true;
      if (req.user) return false;
      // Bootstrap: only with the explicit flag, and only while no account exists.
      if (process.env.CMS_ALLOW_FIRST_USER !== "true") return false;
      const { totalDocs } = await req.payload.count({ collection: "users", overrideAccess: true });
      return totalDocs === 0;
    },
    unlock: adminsOnly,
  },
  hooks: {
    beforeOperation: [
      ({ operation, args, req }) => {
        // No anonymous account creation over HTTP — including Payload's built-in
        // first-register endpoint, which bypasses collection access control.
        // Only the server-side seed script (Local API) or an explicit bootstrap
        // window (CMS_ALLOW_FIRST_USER=true, no users yet) may create the first account.
        if (operation === "create" && !req.user && req.payloadAPI !== "local" && process.env.CMS_ALLOW_FIRST_USER !== "true") {
          throw new APIError("Account creation is disabled. An Admin creates accounts.", 403, null, true);
        }
        // Without an email service, Payload would write reset links to the server log. Until
        // one is configured, an Admin resets passwords in the Admin Portal instead.
        if (operation === "forgotPassword" && !process.env.CMS_EMAIL_CONFIGURED) {
          throw new APIError("Password reset by email is not available yet. Ask an Admin to reset your password.", 403, null, true);
        }
        return args;
      },
    ],
    beforeValidate: [
      ({ data }) => {
        const pw = (data as { password?: unknown } | undefined)?.password;
        if (typeof pw === "string" && pw.length < MIN_PASSWORD) throw new APIError(`Password must be at least ${MIN_PASSWORD} characters.`, 400, null, true);
        return data;
      },
    ],
    beforeChange: [
      async ({ data, operation, req }) => {
        // The bootstrap account is always an Admin.
        if (operation === "create" && !req.user) {
          const { totalDocs } = await req.payload.count({ collection: "users", overrideAccess: true, req });
          if (totalDocs === 0) data.role = "admin";
        }
        return data;
      },
    ],
    afterChange: [auditUserChange],
  },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "editor",
      saveToJWT: true,
      options: ROLES.map((r) => ({ label: r[0].toUpperCase() + r.slice(1), value: r })),
      access: { create: adminField, update: adminField },
      admin: { description: "Editor: drafts and submits. Reviewer: approves and publishes. Admin: also users, settings and Approved corporate classification." },
    },
  ],
};
