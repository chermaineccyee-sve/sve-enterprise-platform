/**
 * Unit tests for the actor-resolution + CSRF/origin gate
 * (src/api/middleware/dataVaultActor.ts). These are fast, no-database
 * tests of the gate itself — the full authenticated-and-RBAC-permitted
 * write path is covered end-to-end in test/integration/http.test.ts.
 * Covers exactly the six scenarios required by the PR #5 correction:
 * trusted-origin cookie POST succeeds through the gate; missing-origin
 * cookie POST is rejected; hostile-origin cookie POST is rejected; GET
 * remains usable under cookie auth with no origin at all; native
 * bearer-token calls are never subject to the origin check; and a
 * rejected check never reaches any business/user lookup.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { requireDataVaultActor } from "../../src/api/middleware/dataVaultActor.ts";
import { CsrfOriginRejectedError } from "../../src/domain/errors.ts";
import { SessionInvalidError, IdentityNotProvisionedError } from "../../../identity/src/domain/errors.ts";
import type { DataVaultContainer } from "../../src/composition/container.ts";
import type { User } from "../../../identity/src/domain/entities.ts";

const SECRET = "unit-test-svegip-bridge-secret";
const TRUSTED_ORIGIN = "https://portal.sve.example";

function toBase64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function buildCookie(email: string, secret = SECRET): string {
  const payload = toBase64Url(Buffer.from(JSON.stringify({ email, exp: Date.now() + 60_000 }), "utf8"));
  const signature = toBase64Url(createHmac("sha256", secret).update(payload, "utf8").digest());
  return `svegip_session=${payload}.${signature}`;
}

function fakeReq(opts: { method?: string; headers?: Record<string, string> }): IncomingMessage {
  return { method: opts.method ?? "GET", headers: opts.headers ?? {}, socket: {} } as unknown as IncomingMessage;
}

function fictionalUser(email: string): User {
  const now = new Date().toISOString();
  return { id: `user-${email}`, email, accountType: "employee", status: "active", createdAt: now, updatedAt: now };
}

function fakeContainer(overrides: Partial<DataVaultContainer> & { findByEmailCalls?: { count: number } } = {}): DataVaultContainer {
  const findByEmailCalls = overrides.findByEmailCalls ?? { count: 0 };
  return {
    users: {
      findById: async () => null,
      findByEmail: async (email: string) => {
        findByEmailCalls.count++;
        return fictionalUser(email);
      },
      createUser: async () => {
        throw new Error("not used in this test");
      },
      setStatus: async () => {},
      setCredential: async () => {},
      getCredential: async () => null,
      linkEmployee: async () => {
        throw new Error("not used in this test");
      },
    },
    sessions: {
      validateSession: async () => {
        throw new SessionInvalidError("not_found");
      },
      createSession: async () => {
        throw new Error("not used in this test");
      },
      revokeSession: async () => {},
      revokeAllSessionsForUser: async () => 0,
      listActiveSessions: async () => [],
      expireDueSessions: async () => 0,
    },
    // organisation/rbac/audit/dataVault are not exercised by the actor
    // gate itself — left undefined-but-typed via `as` since this test
    // only calls requireDataVaultActor, which never touches them.
    organisation: undefined as never,
    rbac: undefined as never,
    audit: undefined as never,
    dataVault: undefined as never,
    svegipBridgeSecret: SECRET,
    trustedOrigins: new Set([TRUSTED_ORIGIN]),
    ...overrides,
  } as DataVaultContainer;
}

test("1. valid SVEGIP cookie + trusted Origin + POST passes the gate (authMethod: svegip-cookie)", async () => {
  const container = fakeContainer();
  const req = fakeReq({ method: "POST", headers: { cookie: buildCookie("writer@example.test"), origin: TRUSTED_ORIGIN } });
  const actor = await requireDataVaultActor(req, container);
  assert.equal(actor.authMethod, "svegip-cookie");
  assert.equal(actor.email, "writer@example.test");
});

test("2. valid SVEGIP cookie + missing Origin/Referer on a state-changing request is rejected", async () => {
  const container = fakeContainer();
  const req = fakeReq({ method: "POST", headers: { cookie: buildCookie("writer@example.test") } });
  await assert.rejects(() => requireDataVaultActor(req, container), CsrfOriginRejectedError);
});

test("3. valid SVEGIP cookie + hostile/untrusted Origin is rejected", async () => {
  const container = fakeContainer();
  const req = fakeReq({ method: "POST", headers: { cookie: buildCookie("writer@example.test"), origin: "https://evil.example" } });
  await assert.rejects(() => requireDataVaultActor(req, container), CsrfOriginRejectedError);
});

test("3b. a Referer-only header is accepted for the origin check when it matches (fallback), and rejected when it doesn't", async () => {
  const container = fakeContainer();
  const okReq = fakeReq({ method: "POST", headers: { cookie: buildCookie("writer@example.test"), referer: TRUSTED_ORIGIN + "/data-vault/" } });
  const actor = await requireDataVaultActor(okReq, container);
  assert.equal(actor.authMethod, "svegip-cookie");

  const badReq = fakeReq({ method: "POST", headers: { cookie: buildCookie("writer@example.test"), referer: "https://evil.example/attack" } });
  await assert.rejects(() => requireDataVaultActor(badReq, container), CsrfOriginRejectedError);
});

test("4. GET remains usable under cookie auth even with no Origin/Referer at all", async () => {
  const container = fakeContainer();
  const req = fakeReq({ method: "GET", headers: { cookie: buildCookie("reader@example.test") } });
  const actor = await requireDataVaultActor(req, container);
  assert.equal(actor.authMethod, "svegip-cookie");
  assert.equal(actor.email, "reader@example.test");
});

test("5. native bearer-token requests are never subject to the origin check, even with a hostile or missing Origin", async () => {
  const activeUser = fictionalUser("bearer.user@example.test");
  const container = fakeContainer({
    sessions: {
      validateSession: async () => ({
        id: "session-1",
        userId: activeUser.id,
        tokenHash: "irrelevant",
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        revokedAt: null,
        revokedReason: null,
        mfaVerified: true,
        ip: null,
        userAgent: null,
      }),
      createSession: async () => {
        throw new Error("not used");
      },
      revokeSession: async () => {},
      revokeAllSessionsForUser: async () => 0,
      listActiveSessions: async () => [],
      expireDueSessions: async () => 0,
    } as DataVaultContainer["sessions"],
    users: {
      findById: async () => activeUser,
      findByEmail: async () => null,
      createUser: async () => {
        throw new Error("not used");
      },
      setStatus: async () => {},
      setCredential: async () => {},
      getCredential: async () => null,
      linkEmployee: async () => {
        throw new Error("not used");
      },
    } as DataVaultContainer["users"],
  });

  // No Origin header at all, and method is POST — would be rejected on the cookie path, but bearer auth must not care.
  const reqNoOrigin = fakeReq({ method: "POST", headers: { authorization: "Bearer some-token" } });
  const actor1 = await requireDataVaultActor(reqNoOrigin, container);
  assert.equal(actor1.authMethod, "bearer");

  // A hostile Origin header present must also be ignored for bearer auth.
  const reqHostileOrigin = fakeReq({ method: "POST", headers: { authorization: "Bearer some-token", origin: "https://evil.example" } });
  const actor2 = await requireDataVaultActor(reqHostileOrigin, container);
  assert.equal(actor2.authMethod, "bearer");
});

test("6. a rejected CSRF check never reaches the Identity user lookup (cannot reach Data Vault mutation logic)", async () => {
  const calls = { count: 0 };
  const container = fakeContainer({ findByEmailCalls: calls });
  const req = fakeReq({ method: "POST", headers: { cookie: buildCookie("writer@example.test"), origin: "https://evil.example" } });
  await assert.rejects(() => requireDataVaultActor(req, container), CsrfOriginRejectedError);
  assert.equal(calls.count, 0, "users.findByEmail must never be called when the origin check fails");
});

test("an unprovisioned SVEGIP-authenticated caller (trusted origin, no matching Identity user) is still denied — CSRF passing is not authorization", async () => {
  const container = fakeContainer({
    users: {
      findById: async () => null,
      findByEmail: async () => null,
      createUser: async () => {
        throw new Error("not used");
      },
      setStatus: async () => {},
      setCredential: async () => {},
      getCredential: async () => null,
      linkEmployee: async () => {
        throw new Error("not used");
      },
    } as DataVaultContainer["users"],
  });
  const req = fakeReq({ method: "POST", headers: { cookie: buildCookie("unprovisioned@example.test"), origin: TRUSTED_ORIGIN } });
  await assert.rejects(() => requireDataVaultActor(req, container), IdentityNotProvisionedError);
});
