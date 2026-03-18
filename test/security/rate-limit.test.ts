import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRateLimitHeaders,
  consumeRateLimit,
  evaluateApiRateLimit,
  getClientIp,
  getRateLimitConfig,
  resolveApiRateLimitProfile,
} from "../../src/lib/rate-limit";

test("rate limiting exposes standard quota headers", async () => {
  const key = `unit-${Date.now()}-${Math.random()}`;
  const nowMs = 1_710_000_000_000;

  const first = await consumeRateLimit({
    identifier: key,
    limit: 2,
    nowMs,
    prefix: "test",
    scope: "ip",
    windowMs: 60_000,
  });
  const second = await consumeRateLimit({
    identifier: key,
    limit: 2,
    nowMs: nowMs + 1,
    prefix: "test",
    scope: "ip",
    windowMs: 60_000,
  });
  const third = await consumeRateLimit({
    identifier: key,
    limit: 2,
    nowMs: nowMs + 2,
    prefix: "test",
    scope: "ip",
    windowMs: 60_000,
  });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);

  const headers = buildRateLimitHeaders([first, second, third], nowMs + 2);
  assert.equal(headers["RateLimit-Limit"], "2");
  assert.equal(headers["RateLimit-Remaining"], "0");
  assert.ok(Number(headers["RateLimit-Reset"]) >= 1);
  assert.ok(Number(headers["Retry-After"]) >= 1);
  assert.match(headers["RateLimit-Policy"], /2;w=60;scope=ip/);
});

test("public and privileged APIs use different default profiles", () => {
  const publicProfile = resolveApiRateLimitProfile({
    isPrivilegedRoute: false,
    pathname: "/api/lead-forms/public",
  });
  const privilegedProfile = resolveApiRateLimitProfile({
    isPrivilegedRoute: true,
    pathname: "/api/me",
  });
  const webhookProfile = resolveApiRateLimitProfile({
    isPrivilegedRoute: false,
    pathname: "/api/stripe/webhook",
  });

  assert.equal(publicProfile.ip.limit, 100);
  assert.equal(privilegedProfile.ip.limit, 300);
  assert.equal(privilegedProfile.user?.limit, 180);
  assert.equal(webhookProfile.ip.limit, 300);
  assert.equal(webhookProfile.user, null);
});

test("rate limit configuration can be overridden by environment variables", () => {
  const originalEnabled = process.env.RATE_LIMIT_ENABLED;
  const originalPublic = process.env.RATE_LIMIT_PUBLIC_MAX_REQUESTS;
  const originalUser = process.env.RATE_LIMIT_AUTH_USER_MAX_REQUESTS;

  process.env.RATE_LIMIT_ENABLED = "false";
  process.env.RATE_LIMIT_PUBLIC_MAX_REQUESTS = "42";
  process.env.RATE_LIMIT_AUTH_USER_MAX_REQUESTS = "84";

  try {
    const config = getRateLimitConfig();
    assert.equal(config.enabled, false);
    assert.equal(config.publicIp.limit, 42);
    assert.equal(config.authenticatedUser.limit, 84);
  } finally {
    process.env.RATE_LIMIT_ENABLED = originalEnabled;
    process.env.RATE_LIMIT_PUBLIC_MAX_REQUESTS = originalPublic;
    process.env.RATE_LIMIT_AUTH_USER_MAX_REQUESTS = originalUser;
  }
});

test("disabling rate limiting bypasses quota accounting", async () => {
  const originalEnabled = process.env.RATE_LIMIT_ENABLED;
  process.env.RATE_LIMIT_ENABLED = "false";

  try {
    const result = await evaluateApiRateLimit({
      isPrivilegedRoute: true,
      pathname: "/api/me",
      request: new Request("https://example.com/api/me", {
        headers: {
          "x-forwarded-for": "203.0.113.5",
        },
      }),
      userId: "11111111-1111-1111-1111-111111111111",
    });

    assert.equal(result.allowed, true);
    assert.deepEqual(result.headers, {});
    assert.equal(result.states.length, 0);
  } finally {
    process.env.RATE_LIMIT_ENABLED = originalEnabled;
  }
});

test("client IP prefers the first forwarded address", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.10, 10.0.0.1",
    "x-real-ip": "198.51.100.2",
  });
  assert.equal(getClientIp(headers), "203.0.113.10");
});
