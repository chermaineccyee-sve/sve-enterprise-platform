import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createInMemoryStore } from "../../src/repositories/memory/inMemoryStore.ts";
import { createInMemorySessionRepository } from "../../src/repositories/memory/inMemorySessionRepository.ts";
import { createSessionService } from "../../src/services/sessionService.ts";
import { SessionInvalidError } from "../../src/domain/errors.ts";

function setup() {
  const store = createInMemoryStore();
  const sessions = createInMemorySessionRepository(store);
  return { store, sessions, service: createSessionService({ sessions }) };
}

test("createSession then validateSession returns the live session", async () => {
  const { service } = setup();
  const userId = randomUUID();
  const { token } = await service.createSession({ userId, mfaVerified: true });
  const validated = await service.validateSession(token);
  assert.equal(validated.userId, userId);
  assert.equal(validated.mfaVerified, true);
});

test("the raw token is never stored — token_hash differs from the token itself", async () => {
  const { service } = setup();
  const { session, token } = await service.createSession({ userId: randomUUID(), mfaVerified: false });
  assert.notEqual(session.tokenHash, token);
});

test("an expired session is rejected", async () => {
  const { service } = setup();
  const { token } = await service.createSession({ userId: randomUUID(), mfaVerified: true, ttlSeconds: -1 });
  await assert.rejects(() => service.validateSession(token), SessionInvalidError);
});

test("a revoked session is rejected", async () => {
  const { service } = setup();
  const { session, token } = await service.createSession({ userId: randomUUID(), mfaVerified: true });
  await service.revokeSession(session.id, "user_signed_out");
  await assert.rejects(() => service.validateSession(token), SessionInvalidError);
});

test("an unknown token is rejected", async () => {
  const { service } = setup();
  await assert.rejects(() => service.validateSession("not-a-real-token"), SessionInvalidError);
});

test("revokeAllSessionsForUser invalidates every active session for that user but not another user's", async () => {
  const { service } = setup();
  const userA = randomUUID();
  const userB = randomUUID();
  const a1 = await service.createSession({ userId: userA, mfaVerified: true });
  const a2 = await service.createSession({ userId: userA, mfaVerified: true });
  const b1 = await service.createSession({ userId: userB, mfaVerified: true });

  const count = await service.revokeAllSessionsForUser(userA, "password_reset");
  assert.equal(count, 2);

  await assert.rejects(() => service.validateSession(a1.token), SessionInvalidError);
  await assert.rejects(() => service.validateSession(a2.token), SessionInvalidError);
  // The other user's session is unaffected.
  const stillValid = await service.validateSession(b1.token);
  assert.equal(stillValid.userId, userB);
});

test("listActiveSessions only returns non-revoked, non-expired sessions for that user", async () => {
  const { service } = setup();
  const userId = randomUUID();
  const active = await service.createSession({ userId, mfaVerified: true });
  const revoked = await service.createSession({ userId, mfaVerified: true });
  await service.revokeSession(revoked.session.id, "test");

  const list = await service.listActiveSessions(userId);
  assert.equal(list.length, 1);
  assert.equal(list[0]?.id, active.session.id);
});

test("expireDueSessions marks past-expiry sessions as revoked with reason 'expired'", async () => {
  const { service } = setup();
  const { session } = await service.createSession({ userId: randomUUID(), mfaVerified: true, ttlSeconds: -5 });
  const count = await service.expireDueSessions();
  assert.equal(count, 1);
  const list = await service.listActiveSessions(session.userId);
  assert.equal(list.length, 0);
});
