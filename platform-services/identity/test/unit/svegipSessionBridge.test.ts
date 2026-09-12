import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifySvegipSessionCookie } from "../../src/services/svegipSessionBridge.ts";

// Mirrors apps/svegip/netlify/functions/login.mts's own b64url()/hmac() —
// re-derived here (not imported, since that file is Netlify-runtime .mts
// using Web Crypto) purely to build fixture cookies for this test.
function toBase64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildCookie(payloadObj: Record<string, unknown>, secret: string): string {
  const payload = toBase64Url(Buffer.from(JSON.stringify(payloadObj), "utf8"));
  const signature = toBase64Url(createHmac("sha256", secret).update(payload, "utf8").digest());
  return `svegip_session=${payload}.${signature}`;
}

const SECRET = "fictional-test-only-bridge-secret";

test("a validly signed, unexpired SVEGIP cookie verifies and returns only the email", () => {
  const cookie = buildCookie({ email: "Bridge.User@Example.Test", role: "Administrator", exp: Date.now() + 60_000 }, SECRET);
  const result = verifySvegipSessionCookie(cookie, SECRET);
  assert.deepEqual(result, { email: "bridge.user@example.test" });
});

test("the verified result never exposes the cookie's embedded role/permissions", () => {
  const cookie = buildCookie(
    { email: "user@example.test", role: "Administrator", permissions: ["vault.admin"], dataVaultAccess: true, exp: Date.now() + 60_000 },
    SECRET,
  );
  const result = verifySvegipSessionCookie(cookie, SECRET);
  assert.deepEqual(Object.keys(result!), ["email"], "only email may ever come out of the bridge");
});

test("an expired cookie is rejected", () => {
  const cookie = buildCookie({ email: "user@example.test", exp: Date.now() - 1000 }, SECRET);
  assert.equal(verifySvegipSessionCookie(cookie, SECRET), null);
});

test("a cookie signed with the wrong secret is rejected", () => {
  const cookie = buildCookie({ email: "user@example.test", exp: Date.now() + 60_000 }, "a-different-secret");
  assert.equal(verifySvegipSessionCookie(cookie, SECRET), null);
});

test("a tampered payload (email changed after signing) is rejected", () => {
  const cookie = buildCookie({ email: "victim@example.test", exp: Date.now() + 60_000 }, SECRET);
  const [name, token] = cookie.split("=");
  const [payload, signature] = token!.split(".");
  const tamperedPayload = toBase64Url(Buffer.from(JSON.stringify({ email: "attacker@example.test", exp: Date.now() + 60_000 }), "utf8"));
  assert.notEqual(tamperedPayload, payload);
  const tampered = `${name}=${tamperedPayload}.${signature}`;
  assert.equal(verifySvegipSessionCookie(tampered, SECRET), null);
});

test("missing cookie header returns null", () => {
  assert.equal(verifySvegipSessionCookie(undefined, SECRET), null);
  assert.equal(verifySvegipSessionCookie(null, SECRET), null);
  assert.equal(verifySvegipSessionCookie("", SECRET), null);
});

test("a cookie header without svegip_session in it returns null", () => {
  assert.equal(verifySvegipSessionCookie("other_cookie=abc; another=def", SECRET), null);
});

test("malformed token (no signature separator) returns null", () => {
  assert.equal(verifySvegipSessionCookie("svegip_session=not-a-valid-token", SECRET), null);
});

test("a cookie missing the email field is rejected", () => {
  const cookie = buildCookie({ exp: Date.now() + 60_000 }, SECRET);
  assert.equal(verifySvegipSessionCookie(cookie, SECRET), null);
});

test("finds the right cookie among several on the header", () => {
  const real = buildCookie({ email: "user@example.test", exp: Date.now() + 60_000 }, SECRET);
  const header = `theme=dark; ${real}; other=1`;
  const result = verifySvegipSessionCookie(header, SECRET);
  assert.deepEqual(result, { email: "user@example.test" });
});
