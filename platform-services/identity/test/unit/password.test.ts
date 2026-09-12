import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, DEFAULT_SCRYPT_PARAMS } from "../../src/crypto/password.ts";

test("verifyPassword accepts the correct password", async () => {
  const hashed = await hashPassword("Correct Horse Battery Staple 1!");
  assert.equal(await verifyPassword("Correct Horse Battery Staple 1!", hashed), true);
});

test("verifyPassword rejects an incorrect password", async () => {
  const hashed = await hashPassword("Correct Horse Battery Staple 1!");
  assert.equal(await verifyPassword("wrong password", hashed), false);
});

test("two hashes of the same password use different random salts and hashes", async () => {
  const a = await hashPassword("same-password-both-times");
  const b = await hashPassword("same-password-both-times");
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash);
  assert.equal(await verifyPassword("same-password-both-times", a), true);
  assert.equal(await verifyPassword("same-password-both-times", b), true);
});

test("hashPassword records the parameters used, matching the default", async () => {
  const hashed = await hashPassword("params-check");
  assert.deepEqual(hashed.params, DEFAULT_SCRYPT_PARAMS);
  assert.equal(hashed.algorithm, "scrypt");
});

test("verifyPassword never throws on empty input", async () => {
  const hashed = await hashPassword("some-real-password");
  assert.equal(await verifyPassword("", hashed), false);
});
