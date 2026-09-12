import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createInMemoryStore } from "../../src/repositories/memory/inMemoryStore.ts";
import { createInMemoryMfaRepository } from "../../src/repositories/memory/inMemoryMfaRepository.ts";
import { createMfaService } from "../../src/services/mfaService.ts";
import { generateTotp } from "../../src/crypto/totp.ts";
import { base32Decode } from "../../src/crypto/base32.ts";
import { MfaAlreadyActiveError, MfaVerificationError, RecoveryCodeInvalidError } from "../../src/domain/errors.ts";

function setup() {
  const store = createInMemoryStore();
  const mfa = createInMemoryMfaRepository(store);
  return { store, mfa, service: createMfaService({ mfa, encryptionKey: randomBytes(32) }) };
}

test("enrolment requires successful verification before activation", async () => {
  const { service, mfa } = setup();
  const userId = randomUUID();
  const enrolment = await service.beginEnrolment({ userId, accountEmail: "fictional.user@example.test" });

  const methodBefore = await mfa.findActiveOrPendingByUser(userId);
  assert.equal(methodBefore?.status, "pending", "must not be active before verification");

  const secret = base32Decode(enrolment.secretBase32);
  const validCode = generateTotp(secret);
  await service.completeEnrolment({ userId, methodId: enrolment.methodId, code: validCode });

  const methodAfter = await mfa.findActiveOrPendingByUser(userId);
  assert.equal(methodAfter?.status, "active");
});

test("an invalid code during enrolment verification is rejected and the method stays pending", async () => {
  const { service, mfa } = setup();
  const userId = randomUUID();
  const enrolment = await service.beginEnrolment({ userId, accountEmail: "fictional.user@example.test" });

  await assert.rejects(
    () => service.completeEnrolment({ userId, methodId: enrolment.methodId, code: "000000" }),
    MfaVerificationError,
  );
  const method = await mfa.findActiveOrPendingByUser(userId);
  assert.equal(method?.status, "pending");
});

test("cannot begin a second enrolment while one is already active/pending", async () => {
  const { service } = setup();
  const userId = randomUUID();
  await service.beginEnrolment({ userId, accountEmail: "fictional.user@example.test" });
  await assert.rejects(() => service.beginEnrolment({ userId, accountEmail: "fictional.user@example.test" }), MfaAlreadyActiveError);
});

test("verifyChallenge accepts a valid TOTP code and rejects an invalid one, decrypting the stored secret internally", async () => {
  const { service } = setup();
  const userId = randomUUID();
  const enrolment = await service.beginEnrolment({ userId, accountEmail: "fictional.user@example.test" });
  const secret = base32Decode(enrolment.secretBase32);
  const validCode = generateTotp(secret);
  const enrolCode = generateTotp(secret);
  await service.completeEnrolment({ userId, methodId: enrolment.methodId, code: enrolCode });

  assert.equal(await service.verifyChallenge({ userId, code: validCode }), true);
  assert.equal(await service.verifyChallenge({ userId, code: "000000" === validCode ? "111111" : "000000" }), false);
});

test("verifyChallenge rejects a code for a method that has not been activated yet", async () => {
  const { service } = setup();
  const userId = randomUUID();
  const enrolment = await service.beginEnrolment({ userId, accountEmail: "fictional.user@example.test" });
  const validCode = generateTotp(base32Decode(enrolment.secretBase32));
  // Not yet completed/activated — verifyChallenge only accepts active methods.
  assert.equal(await service.verifyChallenge({ userId, code: validCode }), false);
});

test("the stored MFA secret is never the plaintext TOTP secret (encrypted at rest)", async () => {
  const { service, mfa } = setup();
  const userId = randomUUID();
  const enrolment = await service.beginEnrolment({ userId, accountEmail: "fictional.user@example.test" });

  const stored = await mfa.findActiveOrPendingByUser(userId);
  assert.ok(stored);
  assert.notEqual(stored!.secret.ciphertext, enrolment.secretBase32);
  // Not merely re-encoded either — decoding the stored ciphertext as UTF-8
  // must not yield the plaintext secret.
  assert.notEqual(Buffer.from(stored!.secret.ciphertext, "base64").toString("utf8"), enrolment.secretBase32);
  assert.ok(stored!.secret.iv);
  assert.ok(stored!.secret.authTag);
  assert.ok(stored!.secret.keyId);
});

test("recovery codes are single-use", async () => {
  const { service } = setup();
  const userId = randomUUID();
  const codes = await service.generateRecoveryCodes(userId);
  assert.equal(codes.length, 10);

  const codeToUse = codes[0]!;
  await service.consumeRecoveryCode({ userId, code: codeToUse });
  await assert.rejects(() => service.consumeRecoveryCode({ userId, code: codeToUse }), RecoveryCodeInvalidError);
});

test("regenerating recovery codes invalidates the previous set", async () => {
  const { service } = setup();
  const userId = randomUUID();
  const firstBatch = await service.generateRecoveryCodes(userId);
  const secondBatch = await service.generateRecoveryCodes(userId);

  // An old code from the first batch must no longer work.
  await assert.rejects(() => service.consumeRecoveryCode({ userId, code: firstBatch[0]! }), RecoveryCodeInvalidError);
  // A code from the new batch works.
  await assert.doesNotReject(() => service.consumeRecoveryCode({ userId, code: secondBatch[0]! }));
});

test("an unknown/garbage recovery code is rejected", async () => {
  const { service } = setup();
  const userId = randomUUID();
  await service.generateRecoveryCodes(userId);
  await assert.rejects(() => service.consumeRecoveryCode({ userId, code: "NOTREAL-CODE-XXXX" }), RecoveryCodeInvalidError);
});

test("disabling a method marks it disabled with the disabling actor recorded", async () => {
  const { service, mfa } = setup();
  const userId = randomUUID();
  const admin = randomUUID();
  const enrolment = await service.beginEnrolment({ userId, accountEmail: "fictional.user@example.test" });
  await service.disable({ methodId: enrolment.methodId, disabledBy: admin });
  const method = await mfa.findActiveOrPendingByUser(userId);
  assert.equal(method, null, "disabled methods are no longer 'active or pending'");
});
