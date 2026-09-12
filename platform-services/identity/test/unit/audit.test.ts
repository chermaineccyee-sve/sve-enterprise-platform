import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createInMemoryStore } from "../../src/repositories/memory/inMemoryStore.ts";
import { createInMemoryAuditRepository } from "../../src/repositories/memory/inMemoryAuditRepository.ts";
import { createAuditService } from "../../src/services/auditService.ts";

test("recording a security event stores the expected shape", async () => {
  const store = createInMemoryStore();
  const audit = createInMemoryAuditRepository(store);
  const service = createAuditService({ audit });
  const userId = randomUUID();

  const event = await service.record({
    actorUserId: userId,
    actorEmail: "fictional.user@example.test",
    action: "auth.login.success",
    resourceType: "session",
    resourceId: "some-session-id",
  });

  assert.equal(event.action, "auth.login.success");
  assert.equal(event.actorUserId, userId);
  assert.ok(event.occurredAt);
  assert.ok(event.id);
});

test("passwords, tokens, secrets and recovery codes are stripped from audit change metadata", async () => {
  const store = createInMemoryStore();
  const audit = createInMemoryAuditRepository(store);
  const service = createAuditService({ audit });

  const event = await service.record({
    actorUserId: null,
    actorEmail: "fictional.user@example.test",
    action: "credential.changed",
    resourceType: "user_credentials",
    changeBefore: { password: "should-never-appear", updatedAt: "2026-01-01T00:00:00Z" },
    changeAfter: { token: "should-never-appear-either", totpSecret: "nope", codeHash: "nope", updatedAt: "2026-01-02T00:00:00Z" },
  });

  assert.equal(event.changeBefore?.password, undefined);
  assert.equal(event.changeBefore?.updatedAt, "2026-01-01T00:00:00Z");
  assert.equal(event.changeAfter?.token, undefined);
  assert.equal(event.changeAfter?.totpSecret, undefined);
  assert.equal(event.changeAfter?.codeHash, undefined);
  assert.equal(event.changeAfter?.updatedAt, "2026-01-02T00:00:00Z");

  // Confirm the raw serialized event genuinely contains none of the secret values.
  const serialized = JSON.stringify(event);
  assert.doesNotMatch(serialized, /should-never-appear/);
});
