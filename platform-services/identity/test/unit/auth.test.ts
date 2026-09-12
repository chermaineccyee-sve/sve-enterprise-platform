import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createInMemoryStore } from "../../src/repositories/memory/inMemoryStore.ts";
import { createInMemoryUserRepository } from "../../src/repositories/memory/inMemoryUserRepository.ts";
import { createInMemoryAttemptRepository } from "../../src/repositories/memory/inMemoryAttemptRepository.ts";
import { createInMemoryMfaRepository } from "../../src/repositories/memory/inMemoryMfaRepository.ts";
import { createAuthService } from "../../src/services/authService.ts";
import { createMfaService } from "../../src/services/mfaService.ts";
import { createRateLimiter } from "../../src/services/rateLimiter.ts";
import { hashPassword } from "../../src/crypto/password.ts";
import { generateTotp } from "../../src/crypto/totp.ts";
import { base32Decode } from "../../src/crypto/base32.ts";
import { InvalidCredentialsError, AccountDisabledError, ThrottledError } from "../../src/domain/errors.ts";

// Fictional test identity only — see fixtures/fictionalUsers.ts for the
// shared convention used across this test suite.
const FICTIONAL_EMAIL = "test.pilot@example.test";
const FICTIONAL_PASSWORD = "correct-horse-battery-staple-42!";

async function setup() {
  const store = createInMemoryStore();
  const users = createInMemoryUserRepository(store);
  const attempts = createInMemoryAttemptRepository(store);
  const mfaRepo = createInMemoryMfaRepository(store);
  const mfa = createMfaService({ mfa: mfaRepo });
  const rateLimiter = createRateLimiter({ attempts });
  const auth = createAuthService({ users, attempts, mfa, rateLimiter });

  const user = await users.createUser({ email: FICTIONAL_EMAIL, accountType: "employee" });
  await users.setCredential(user.id, await hashPassword(FICTIONAL_PASSWORD));

  return { store, users, mfa, mfaRepo, auth, user };
}

test("valid password authenticates when no MFA is enrolled", async () => {
  const { auth } = await setup();
  const result = await auth.login({ email: FICTIONAL_EMAIL, password: FICTIONAL_PASSWORD });
  assert.equal(result.outcome, "authenticated");
});

test("invalid password is rejected", async () => {
  const { auth } = await setup();
  await assert.rejects(() => auth.login({ email: FICTIONAL_EMAIL, password: "wrong-password" }), InvalidCredentialsError);
});

test("unknown account produces the same generic error as a wrong password (enumeration resistance)", async () => {
  const { auth } = await setup();
  let unknownError: unknown;
  let wrongPasswordError: unknown;
  try {
    await auth.login({ email: "does.not.exist@example.test", password: "anything" });
  } catch (e) {
    unknownError = e;
  }
  try {
    await auth.login({ email: FICTIONAL_EMAIL, password: "wrong-password" });
  } catch (e) {
    wrongPasswordError = e;
  }
  assert.ok(unknownError instanceof InvalidCredentialsError);
  assert.ok(wrongPasswordError instanceof InvalidCredentialsError);
  assert.equal((unknownError as Error).message, (wrongPasswordError as Error).message, "messages must be identical, not just the same class");
});

test("a disabled account is rejected even with the correct password", async () => {
  const { auth, users, user } = await setup();
  await users.setStatus(user.id, "disabled");
  await assert.rejects(() => auth.login({ email: FICTIONAL_EMAIL, password: FICTIONAL_PASSWORD }), AccountDisabledError);
});

test("repeated failures trigger throttling (rate-limit behaviour)", async () => {
  const { auth } = await setup();
  for (let i = 0; i < 5; i++) {
    await assert.rejects(() => auth.login({ email: FICTIONAL_EMAIL, password: "wrong" }));
  }
  await assert.rejects(() => auth.login({ email: FICTIONAL_EMAIL, password: "wrong" }), ThrottledError);
  // Even the *correct* password is throttled once the threshold is hit —
  // otherwise throttling would only ever block the attacker's own guesses.
  await assert.rejects(() => auth.login({ email: FICTIONAL_EMAIL, password: FICTIONAL_PASSWORD }), ThrottledError);
});

test("with MFA enrolled, login returns a challenge instead of an authenticated session", async () => {
  const { auth, mfa, user } = await setup();
  const enrolment = await mfa.beginEnrolment({ userId: user.id, accountEmail: FICTIONAL_EMAIL });
  const code = generateTotp(base32Decode(enrolment.secretBase32));
  await mfa.completeEnrolment({ userId: user.id, methodId: enrolment.methodId, code, secretBase32: enrolment.secretBase32 });

  const result = await auth.login({ email: FICTIONAL_EMAIL, password: FICTIONAL_PASSWORD });
  assert.equal(result.outcome, "mfa_challenge");
  assert.ok(result.challengeId);
});

test("resolveChallenge returns the userId once, then consumes it", async () => {
  const { auth, mfa, user } = await setup();
  const enrolment = await mfa.beginEnrolment({ userId: user.id, accountEmail: FICTIONAL_EMAIL });
  const code = generateTotp(base32Decode(enrolment.secretBase32));
  await mfa.completeEnrolment({ userId: user.id, methodId: enrolment.methodId, code, secretBase32: enrolment.secretBase32 });

  const result = await auth.login({ email: FICTIONAL_EMAIL, password: FICTIONAL_PASSWORD });
  const resolvedUserId = auth.resolveChallenge(result.challengeId!);
  assert.equal(resolvedUserId, user.id);
  // Consumed — resolving the same challengeId again fails.
  assert.equal(auth.resolveChallenge(result.challengeId!), null);
});
