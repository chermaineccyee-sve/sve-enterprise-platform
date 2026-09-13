/**
 * Unit tests for the actor-resolution + CSRF/origin gate
 * (src/api/middleware/actor.ts) — PR #11's extension of Data Vault's
 * already-accepted SVEGIP session-cookie bridge to HRMS. Mirrors
 * platform-services/data-vault/test/unit/dataVaultActor.test.ts's own
 * scenarios (see that file for the full six-scenario rationale from the
 * original PR #5 correction); this covers the same core set for this
 * package's own gate rather than duplicating every variant.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { requireActor } from "../../src/api/middleware/actor.ts";
import { CsrfOriginRejectedError } from "../../src/domain/errors.ts";
import { SessionInvalidError, IdentityNotProvisionedError, AccountDisabledError } from "../../../identity/src/domain/errors.ts";
import type { HrmsContainer } from "../../src/composition/container.ts";
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

function fictionalUser(email: string, status: "active" | "disabled" = "active"): User {
  const now = new Date().toISOString();
  return { id: `user-${email}`, email, accountType: "employee", status, createdAt: now, updatedAt: now };
}

function fakeContainer(overrides: Partial<HrmsContainer> = {}): HrmsContainer {
  return {
    users: {
      findById: async () => null,
      findByIdForUpdate: async () => null,
      findByEmail: async (email: string) => fictionalUser(email),
      createUser: async () => {
        throw new Error("not used in this test");
      },
      setStatus: async () => {},
      setCredential: async () => {},
      getCredential: async () => null,
      linkEmployee: async () => {
        throw new Error("not used in this test");
      },
      findActiveLinkByUserId: async () => null,
      findActiveLinkByEmployeeId: async () => null,
      unlinkEmployee: async () => {
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
    organisation: undefined as never,
    rbac: undefined as never,
    audit: undefined as never,
    orgContainer: undefined as never,
    workflow: undefined as never,
    lifecycle: undefined as never,
    onboarding: undefined as never,
    probation: undefined as never,
    employmentChange: undefined as never,
    offboarding: undefined as never,
    approval: undefined as never,
    identityDeactivation: undefined as never,
    svegipBridgeSecret: SECRET,
    trustedOrigins: new Set([TRUSTED_ORIGIN]),
    ...overrides,
  } as HrmsContainer;
}

test("valid SVEGIP cookie + trusted Origin + POST passes the gate (authMethod: svegip-cookie)", async () => {
  const container = fakeContainer();
  const req = fakeReq({ method: "POST", headers: { cookie: buildCookie("writer@example.test"), origin: TRUSTED_ORIGIN } });
  const actor = await requireActor(req, container);
  assert.equal(actor.authMethod, "svegip-cookie");
  assert.equal(actor.email, "writer@example.test");
});

test("valid SVEGIP cookie + missing Origin/Referer on a state-changing request is rejected", async () => {
  const container = fakeContainer();
  const req = fakeReq({ method: "POST", headers: { cookie: buildCookie("writer@example.test") } });
  await assert.rejects(() => requireActor(req, container), CsrfOriginRejectedError);
});

test("valid SVEGIP cookie + hostile Origin on a state-changing request is rejected", async () => {
  const container = fakeContainer();
  const req = fakeReq({ method: "POST", headers: { cookie: buildCookie("writer@example.test"), origin: "https://evil.example" } });
  await assert.rejects(() => requireActor(req, container), CsrfOriginRejectedError);
});

test("GET remains usable under cookie auth even with no Origin/Referer at all", async () => {
  const container = fakeContainer();
  const req = fakeReq({ method: "GET", headers: { cookie: buildCookie("reader@example.test") } });
  const actor = await requireActor(req, container);
  assert.equal(actor.authMethod, "svegip-cookie");
  assert.equal(actor.email, "reader@example.test");
});

test("native bearer-token requests are never subject to the origin check", async () => {
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
    } as HrmsContainer["sessions"],
    users: {
      findById: async () => activeUser,
      findByIdForUpdate: async () => activeUser,
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
      findActiveLinkByUserId: async () => null,
      findActiveLinkByEmployeeId: async () => null,
      unlinkEmployee: async () => {
        throw new Error("not used");
      },
    } as HrmsContainer["users"],
  });
  const req = fakeReq({ method: "POST", headers: { authorization: "Bearer some-token", origin: "https://evil.example" } });
  const actor = await requireActor(req, container);
  assert.equal(actor.authMethod, "bearer");
});

test("an unprovisioned SVEGIP-authenticated caller (trusted origin, no matching Identity user) is still denied", async () => {
  const container = fakeContainer({ users: { ...fakeContainer().users, findByEmail: async () => null } });
  const req = fakeReq({ method: "POST", headers: { cookie: buildCookie("unprovisioned@example.test"), origin: TRUSTED_ORIGIN } });
  await assert.rejects(() => requireActor(req, container), IdentityNotProvisionedError);
});

test("a disabled Identity user authenticated via the SVEGIP cookie bridge is denied", async () => {
  const container = fakeContainer({ users: { ...fakeContainer().users, findByEmail: async (email: string) => fictionalUser(email, "disabled") } });
  const req = fakeReq({ method: "GET", headers: { cookie: buildCookie("disabled@example.test") } });
  await assert.rejects(() => requireActor(req, container), AccountDisabledError);
});
