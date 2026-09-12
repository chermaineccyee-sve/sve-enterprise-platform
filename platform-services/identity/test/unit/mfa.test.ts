import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createInMemoryStore } from "../../src/repositories/memory/inMemoryStore.ts";
import { createInMemoryMfaRepository } from "../../src/repositories/memory/inMemoryMfaRepository.ts";
import { createMfaService } from "../../src/services/mfaService.ts";
import { generateTotp } from "../../src/crypto/totp.ts";
import { base32Decode } from "../../src/crypto/base32.ts";
import { MfaAlreadyActiveError, MfaVerificationError, RecoveryCodeInvalidError } from "../../src/domain/errors.ts";

function setup() {
  const store = createInMemoryStore();
  const mfa = createInMemoryMfaRepository(store);
  return { store, mfa, service: createMfaService({ mfa }) };
}

test("enrolment requires successful verification before activation", async () => {
  const { service, mfa } = setup();
  const userId = randomUUID();
  const enrolment = await service.beginEnrolment({ userId, accountEmail: "fictional.user@example.test" });

  const methodBefore = await mfa.findActiveOrPendingByUser(userId);
  assert.equal(methodBefore?.status, "pending", "must not be active before verification");

  const secret = base32Decode(enrolment.secretBase32);
  const validCode = generateTotp(secret);
  await service.completeEnrolment({ userId, methodId: enrolment.methodId, code: validCode, secretBase32: enrolment.secretBase32 });

  const methodAfter = await mfa.findActiveOrPendingByUser(userId);
  assert.equal(methodAfter?.status, "active");
});

test("an invalid code during enrolment verification is rejected and the method stays pending", async () => {
  const { service, mfa } = setup();
  const userId = randomUUID();
  const enrolment = await service.beginEnrolment({ userId, accountEmail: "fictional.user@example.test" });

  await assert.rejects(
    () => service.completeEnrolment({ userId, methodId: enrolment.methodId, code: "000000", secretBase32: enrolment.secretBase32 }),
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

test("verifyChallenge accepts a valid TOTP code and rejects an invalid one", async () => {
  const { service } = setup();
  const userId = randomUUID();
  const enrolment = await service.beginEnrolment({ userId, accountEmail: "fictional.user@example.test" });
  const secret = base32Decode(enrolment.secretBase32);
  const validCode = generateTotp(secret);

  assert.equal(await service.verifyChallenge({ secretBase32: enrolment.secretBase32, code: validCode }), true);
  assert.equal(await service.verifyChallenge({ secretBase32: enrolment.secretBase32, code: "000000" }), false);
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
