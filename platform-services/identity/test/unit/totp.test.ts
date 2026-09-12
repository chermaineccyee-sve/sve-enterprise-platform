import test from "node:test";
import assert from "node:assert/strict";
import { hotp, generateTotp, verifyTotp, generateTotpSecret, buildOtpauthUri } from "../../src/crypto/totp.ts";
import { base32Decode, base32Encode } from "../../src/crypto/base32.ts";

// RFC 4226 Appendix D official test vectors — secret is the ASCII string
// "12345678901234567890" (20 bytes), HMAC-SHA1, 6-digit codes. This proves
// our HOTP core (which TOTP is built on) is standards-correct, not just
// self-consistent.
const RFC4226_SECRET = new TextEncoder().encode("12345678901234567890");
const RFC4226_VECTORS = [
  "755224", "287082", "359152", "969429", "338314",
  "254676", "287922", "162583", "399871", "520489",
];

test("hotp matches RFC 4226 Appendix D test vectors", () => {
  RFC4226_VECTORS.forEach((expected, counter) => {
    assert.equal(hotp(RFC4226_SECRET, BigInt(counter)), expected, `counter ${counter}`);
  });
});

test("generateTotp/verifyTotp round-trip at a fixed time", () => {
  const { secret } = generateTotpSecret();
  const now = 1_700_000_000; // fixed epoch seconds for a deterministic test
  const code = generateTotp(secret, now);
  assert.match(code, /^\d{6}$/);
  const result = verifyTotp(secret, code, now);
  assert.equal(result.valid, true);
});

test("verifyTotp accepts a code from one step in the past (clock drift)", () => {
  const { secret } = generateTotpSecret();
  const now = 1_700_000_000;
  const codeOneStepAgo = generateTotp(secret, now - 30);
  const result = verifyTotp(secret, codeOneStepAgo, now);
  assert.equal(result.valid, true);
});

test("verifyTotp rejects a code two steps out of the allowed window", () => {
  const { secret } = generateTotpSecret();
  const now = 1_700_000_000;
  const codeTwoStepsAgo = generateTotp(secret, now - 60);
  const result = verifyTotp(secret, codeTwoStepsAgo, now);
  assert.equal(result.valid, false);
});

test("verifyTotp rejects a wrong code", () => {
  const { secret } = generateTotpSecret();
  const now = 1_700_000_000;
  const realCode = generateTotp(secret, now);
  const wrongCode = realCode === "000000" ? "111111" : "000000";
  assert.equal(verifyTotp(secret, wrongCode, now).valid, false);
});

test("verifyTotp rejects malformed input without throwing", () => {
  const { secret } = generateTotpSecret();
  assert.equal(verifyTotp(secret, "not-a-code").valid, false);
  assert.equal(verifyTotp(secret, "12345").valid, false);
  assert.equal(verifyTotp(secret, "").valid, false);
});

test("base32 round-trips a TOTP secret", () => {
  const { secret, base32 } = generateTotpSecret();
  assert.deepEqual(Array.from(base32Decode(base32)), Array.from(secret));
  assert.equal(base32Encode(secret), base32);
});

test("buildOtpauthUri produces a well-formed otpauth:// URI without leaking secret formatting issues", () => {
  const uri = buildOtpauthUri({
    secretBase32: "JBSWY3DPEHPK3PXP",
    accountName: "fictional.user@example.test",
    issuer: "SVE Enterprise Platform",
  });
  assert.match(uri, /^otpauth:\/\/totp\//);
  assert.match(uri, /secret=JBSWY3DPEHPK3PXP/);
  assert.match(uri, /issuer=SVE\+Enterprise\+Platform/);
});
