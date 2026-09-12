import test from "node:test";
import assert from "node:assert/strict";
import { createInMemoryStore } from "../../src/repositories/memory/inMemoryStore.ts";
import { createInMemoryAttemptRepository } from "../../src/repositories/memory/inMemoryAttemptRepository.ts";
import { createRateLimiter } from "../../src/services/rateLimiter.ts";

function setup() {
  const store = createInMemoryStore();
  const attempts = createInMemoryAttemptRepository(store);
  return { attempts, limiter: createRateLimiter({ attempts }) };
}

test("no throttle before any failures", async () => {
  const { limiter } = setup();
  assert.equal(await limiter.checkThrottle({ email: "fictional.user@example.test" }), 0);
});

test("throttles after the failure threshold is reached", async () => {
  const { limiter } = setup();
  const email = "fictional.user@example.test";
  for (let i = 0; i < 5; i++) {
    await limiter.recordFailure({ email, reason: "invalid_password" });
  }
  const backoff = await limiter.checkThrottle({ email });
  assert.ok(backoff > 0, "expected a positive backoff after 5 failures");
});

test("throttle escalates with more failures", async () => {
  const { limiter } = setup();
  const email = "fictional.user2@example.test";
  for (let i = 0; i < 5; i++) await limiter.recordFailure({ email, reason: "invalid_password" });
  const firstBackoff = await limiter.checkThrottle({ email });
  for (let i = 0; i < 3; i++) await limiter.recordFailure({ email, reason: "invalid_password" });
  const secondBackoff = await limiter.checkThrottle({ email });
  assert.ok(secondBackoff > firstBackoff, "backoff should increase with repeated failures, not stay flat");
});

test("a successful attempt is recorded but does not itself clear an existing throttle window (still counts recent failures)", async () => {
  const { limiter } = setup();
  const email = "fictional.user3@example.test";
  for (let i = 0; i < 5; i++) await limiter.recordFailure({ email, reason: "invalid_password" });
  await limiter.recordSuccess({ email });
  // Recent failures within the window still count — a single success right
  // after a burst of failures should not silently reset throttling.
  const backoff = await limiter.checkThrottle({ email });
  assert.ok(backoff > 0);
});

test("failures against one email do not throttle a different, unrelated email", async () => {
  const { limiter } = setup();
  for (let i = 0; i < 10; i++) {
    await limiter.recordFailure({ email: "attacker-target@example.test", reason: "invalid_password" });
  }
  const backoff = await limiter.checkThrottle({ email: "unrelated.user@example.test" });
  assert.equal(backoff, 0);
});

test("throttle also keys on IP so distributed attempts against many emails from one source are caught", async () => {
  const { limiter } = setup();
  const ip = "203.0.113.7"; // TEST-NET-3, RFC 5737 — not a real address
  for (let i = 0; i < 6; i++) {
    await limiter.recordFailure({ email: `victim${i}@example.test`, ip, reason: "invalid_password" });
  }
  const backoff = await limiter.checkThrottle({ email: "yet-another-victim@example.test", ip });
  assert.ok(backoff > 0, "same-IP failures across many different emails should still trigger throttling");
});
