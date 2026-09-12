import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { encryptTotpSecret, decryptTotpSecret, loadMfaEncryptionKey, MFA_ENCRYPTION_KEY_ENV_VAR } from "../../src/crypto/mfaSecretCipher.ts";
import { generateTotpSecret } from "../../src/crypto/totp.ts";

function testKey(): Buffer {
  return randomBytes(32);
}

test("encrypt then decrypt recovers the original TOTP secret exactly", () => {
  const key = testKey();
  const { base32 } = generateTotpSecret();
  const encrypted = encryptTotpSecret(base32, key);
  assert.equal(decryptTotpSecret(encrypted, key), base32);
});

test("stored ciphertext does not equal the original plaintext secret", () => {
  const key = testKey();
  const { base32 } = generateTotpSecret();
  const encrypted = encryptTotpSecret(base32, key);
  assert.notEqual(encrypted.ciphertext, base32);
  // Also not trivially recoverable via base64-decoding alone (i.e. genuinely
  // ciphertext, not the plaintext merely re-encoded).
  assert.notEqual(Buffer.from(encrypted.ciphertext, "base64").toString("utf8"), base32);
});

test("two encryptions of the same secret produce different ciphertext and IV (random nonce per call)", () => {
  const key = testKey();
  const { base32 } = generateTotpSecret();
  const a = encryptTotpSecret(base32, key);
  const b = encryptTotpSecret(base32, key);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ciphertext, b.ciphertext);
  // Both still decrypt correctly.
  assert.equal(decryptTotpSecret(a, key), base32);
  assert.equal(decryptTotpSecret(b, key), base32);
});

test("decryption with the wrong key is rejected", () => {
  const key = testKey();
  const wrongKey = testKey();
  const { base32 } = generateTotpSecret();
  const encrypted = encryptTotpSecret(base32, key);
  assert.throws(() => decryptTotpSecret(encrypted, wrongKey));
});

test("decryption of tampered ciphertext is rejected (authentication, not just confidentiality)", () => {
  const key = testKey();
  const { base32 } = generateTotpSecret();
  const encrypted = encryptTotpSecret(base32, key);
  const tamperedBytes = Buffer.from(encrypted.ciphertext, "base64");
  tamperedBytes[0] = (tamperedBytes[0]! ^ 0xff) & 0xff; // flip a bit
  const tampered = { ...encrypted, ciphertext: tamperedBytes.toString("base64") };
  assert.throws(() => decryptTotpSecret(tampered, key));
});

test("decryption with a tampered auth tag is rejected", () => {
  const key = testKey();
  const { base32 } = generateTotpSecret();
  const encrypted = encryptTotpSecret(base32, key);
  const tamperedTag = Buffer.from(encrypted.authTag, "base64");
  tamperedTag[0] = (tamperedTag[0]! ^ 0xff) & 0xff;
  const tampered = { ...encrypted, authTag: tamperedTag.toString("base64") };
  assert.throws(() => decryptTotpSecret(tampered, key));
});

test("loadMfaEncryptionKey rejects a missing key", async () => {
  const secrets = { getSecret: async () => undefined, requireSecret: async () => { throw new Error(`Missing required secret: ${MFA_ENCRYPTION_KEY_ENV_VAR}`); } };
  await assert.rejects(() => loadMfaEncryptionKey(secrets));
});

test("loadMfaEncryptionKey rejects a key of the wrong length", async () => {
  const secrets = { getSecret: async () => "short", requireSecret: async () => Buffer.from("too-short").toString("base64") };
  await assert.rejects(() => loadMfaEncryptionKey(secrets), /32 bytes/);
});

test("loadMfaEncryptionKey accepts a correctly-sized base64 key", async () => {
  const rawKey = randomBytes(32).toString("base64");
  const secrets = { getSecret: async () => rawKey, requireSecret: async () => rawKey };
  const key = await loadMfaEncryptionKey(secrets);
  assert.equal(key.length, 32);
});
