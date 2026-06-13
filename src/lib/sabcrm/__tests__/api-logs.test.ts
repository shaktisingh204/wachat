/**
 * Unit tests for the API-platform PURE helpers (`../api-logs`).
 *   npx tsx --test src/lib/sabcrm/__tests__/api-logs.test.ts
 *
 * Covers log shaping (clamp / normalise / truncate) and the fixed-window
 * rate-limit math + headers. No Mongo, no `server-only` — pure functions only.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  shapeApiLog,
  normaliseMethod,
  normalisePath,
  MAX_LOGGED_PATH,
  rateLimitVerdict,
  rateLimitHeaders,
  clampRateLimit,
  windowIdFor,
  windowResetAt,
  isBulkOp,
  DEFAULT_RATE_LIMIT,
  RATE_LIMIT_WINDOW_MS,
} from "../api-logs";

describe("normaliseMethod", () => {
  it("upper-cases recognised verbs", () => {
    assert.equal(normaliseMethod("get"), "GET");
    assert.equal(normaliseMethod("Patch"), "PATCH");
    assert.equal(normaliseMethod("DELETE"), "DELETE");
  });
  it("maps unknown / empty verbs to OTHER", () => {
    assert.equal(normaliseMethod("TRACE"), "OTHER");
    assert.equal(normaliseMethod(""), "OTHER");
    assert.equal(normaliseMethod(undefined), "OTHER");
    assert.equal(normaliseMethod(123), "OTHER");
  });
});

describe("normalisePath", () => {
  it("strips query string + fragment", () => {
    assert.equal(normalisePath("/api/sabcrm/people?page=2&x=1"), "/api/sabcrm/people");
    assert.equal(normalisePath("/api/sabcrm/people#frag"), "/api/sabcrm/people");
  });
  it("keeps only the pathname of a full URL", () => {
    assert.equal(
      normalisePath("https://app.example.com/api/sabcrm/companies?q=acme"),
      "/api/sabcrm/companies",
    );
  });
  it("falls back to / for empty input", () => {
    assert.equal(normalisePath(""), "/");
    assert.equal(normalisePath(undefined), "/");
  });
  it("truncates an oversize path", () => {
    const long = "/api/" + "a".repeat(MAX_LOGGED_PATH + 100);
    const out = normalisePath(long);
    assert.equal(out.length, MAX_LOGGED_PATH);
  });
});

describe("shapeApiLog", () => {
  it("shapes a clean input", () => {
    const row = shapeApiLog({
      projectId: "p1",
      keyId: "k1",
      method: "post",
      path: "/api/sabcrm/people?x=1",
      status: 201,
      ms: 42.6,
    });
    assert.deepEqual(row, {
      projectId: "p1",
      keyId: "k1",
      method: "POST",
      path: "/api/sabcrm/people",
      status: 201,
      ms: 43, // rounded
    });
  });
  it("clamps an out-of-range status into [100,599]", () => {
    assert.equal(shapeApiLog({ projectId: "p", keyId: "k", method: "GET", path: "/", status: 0, ms: 1 }).status, 100);
    assert.equal(shapeApiLog({ projectId: "p", keyId: "k", method: "GET", path: "/", status: 999, ms: 1 }).status, 599);
  });
  it("clamps negative / non-finite ms to a non-negative integer", () => {
    assert.equal(shapeApiLog({ projectId: "p", keyId: "k", method: "GET", path: "/", status: 200, ms: -5 }).status >= 0, true);
    const r1 = shapeApiLog({ projectId: "p", keyId: "k", method: "GET", path: "/", status: 200, ms: -5 });
    assert.equal(r1.ms, 0);
    const r2 = shapeApiLog({ projectId: "p", keyId: "k", method: "GET", path: "/", status: 200, ms: NaN });
    assert.equal(r2.ms, 0);
  });
  it("coerces non-string ids to strings without throwing", () => {
    const row = shapeApiLog({
      // @ts-expect-error — deliberately wrong type to prove robustness
      projectId: 7,
      // @ts-expect-error — deliberately wrong type
      keyId: null,
      method: "GET",
      path: "/x",
      status: 200,
      ms: 0,
    });
    assert.equal(row.projectId, "7");
    assert.equal(row.keyId, "");
  });
});

describe("clampRateLimit", () => {
  it("defaults a missing cap", () => {
    assert.equal(clampRateLimit(undefined), DEFAULT_RATE_LIMIT);
  });
  it("floors a sub-1 / non-finite cap to 1", () => {
    assert.equal(clampRateLimit(0), 1);
    assert.equal(clampRateLimit(-10), 1);
    assert.equal(clampRateLimit(Number.NaN), 1);
  });
  it("rounds a fractional cap", () => {
    assert.equal(clampRateLimit(10.7), 11);
  });
});

describe("windowIdFor / windowResetAt", () => {
  it("buckets instants in the same window to the same id", () => {
    const base = 5 * RATE_LIMIT_WINDOW_MS;
    assert.equal(windowIdFor(base), windowIdFor(base + RATE_LIMIT_WINDOW_MS - 1));
    assert.equal(windowIdFor(base + RATE_LIMIT_WINDOW_MS), windowIdFor(base) + 1);
  });
  it("resets at the start of the next window", () => {
    const base = 5 * RATE_LIMIT_WINDOW_MS;
    assert.equal(windowResetAt(base), 6 * RATE_LIMIT_WINDOW_MS);
    assert.equal(windowResetAt(base + 1), 6 * RATE_LIMIT_WINDOW_MS);
  });
});

describe("rateLimitVerdict", () => {
  const now = 10 * RATE_LIMIT_WINDOW_MS + 1000; // 1s into a window

  it("allows requests up to and including the cap", () => {
    const atCap = rateLimitVerdict(5, 5, now);
    assert.equal(atCap.allowed, true);
    assert.equal(atCap.remaining, 0);
    assert.equal(atCap.retryAfterSeconds, 0);
  });
  it("denies the request that exceeds the cap", () => {
    const over = rateLimitVerdict(6, 5, now);
    assert.equal(over.allowed, false);
    assert.equal(over.remaining, 0);
    assert.ok(over.retryAfterSeconds >= 1);
  });
  it("reports remaining headroom mid-window", () => {
    const v = rateLimitVerdict(2, 10, now);
    assert.equal(v.allowed, true);
    assert.equal(v.remaining, 8);
  });
  it("retry-after equals seconds to the window reset on denial", () => {
    const v = rateLimitVerdict(100, 1, now);
    const expected = Math.ceil((windowResetAt(now) - now) / 1000);
    assert.equal(v.retryAfterSeconds, expected);
    assert.equal(v.resetAt, windowResetAt(now));
  });
  it("clamps a bogus cap before evaluating", () => {
    // cap 0 is clamped to 1, so the first request is allowed, the second denied.
    assert.equal(rateLimitVerdict(1, 0, now).allowed, true);
    assert.equal(rateLimitVerdict(2, 0, now).allowed, false);
  });
});

describe("rateLimitHeaders", () => {
  const now = 10 * RATE_LIMIT_WINDOW_MS;

  it("emits limit + remaining for an allowed verdict (no Retry-After)", () => {
    const h = rateLimitHeaders(rateLimitVerdict(3, 10, now));
    assert.equal(h["RateLimit-Limit"], "10");
    assert.equal(h["RateLimit-Remaining"], "7");
    assert.equal(h["X-RateLimit-Limit"], "10");
    assert.equal("Retry-After" in h, false);
  });
  it("includes Retry-After for a denied verdict", () => {
    const h = rateLimitHeaders(rateLimitVerdict(11, 10, now));
    assert.equal(h["RateLimit-Remaining"], "0");
    assert.ok(Number(h["Retry-After"]) >= 1);
  });
});

describe("isBulkOp", () => {
  it("accepts the three valid ops", () => {
    assert.equal(isBulkOp("create"), true);
    assert.equal(isBulkOp("update"), true);
    assert.equal(isBulkOp("delete"), true);
  });
  it("rejects anything else", () => {
    assert.equal(isBulkOp("upsert"), false);
    assert.equal(isBulkOp(""), false);
    assert.equal(isBulkOp(undefined), false);
    assert.equal(isBulkOp(5), false);
  });
});
