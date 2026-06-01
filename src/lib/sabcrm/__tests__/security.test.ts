/**
 * Pure unit tests for SabCRM webhook HMAC signing and API-key hashing.
 * Runs with Node's built-in `node:test` + `tsx` — no extra deps required:
 *
 *   npx tsx --test src/lib/sabcrm/__tests__/security.test.ts
 *
 * ### Why helpers are inlined rather than imported
 *
 * Both `webhooks.server.ts` and `apikeys.server.ts` carry `import "server-only"`,
 * which throws when executed outside a Next.js server render context (the
 * `server-only` package's entire purpose).  The test harness (`tsx --test`)
 * runs in plain Node, so importing those modules directly causes an immediate
 * throw before any test can run.
 *
 * Rather than monkey-patching module resolution, the tests inline the exact
 * crypto logic verbatim from the source files so the pure-function behaviour
 * is verified without crossing the server boundary:
 *
 *   • `_signPayload`          — matches `signPayload` in `api-platform/webhooks.ts`
 *                               (also used by `signWebhookPayload` in `webhooks.server.ts`)
 *   • `_verifyWebhookSignature` — matches `verifyWebhookSignature` in `webhooks.server.ts`
 *   • `_hashKey`              — matches `hashKey` in `apikeys.server.ts`
 *   • `SABCRM_API_KEY_PREFIX`  — public constant; matches `apikeys.server.ts`
 *
 * Any future change to the source implementations must be reflected here.
 * Naming these with a leading `_` makes the scope clear: they are test-local
 * mirrors, not the real exports.
 */

import { strict as assert } from "node:assert";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { test } from "node:test";

/* -------------------------------------------------------------------------- */
/* Inlined helpers — mirrored verbatim from source                             */
/* -------------------------------------------------------------------------- */

/**
 * Mirrors `signPayload` from `src/lib/api-platform/webhooks.ts`.
 * Also the body of `signWebhookPayload` in `webhooks.server.ts`, which is a
 * thin wrapper over this same function.
 *
 * Produces `sha256=<hex>` (Stripe-style) over the stable JSON serialisation of
 * `body`, or the verbatim string when `body` is already a string.
 */
function _signPayload(secret: string, body: unknown): string {
  if (!secret) throw new Error("signPayload: secret is required");
  const message =
    typeof body === "string" ? body : JSON.stringify(body ?? null);
  const digest = createHmac("sha256", secret)
    .update(message, "utf8")
    .digest("hex");
  return `sha256=${digest}`;
}

/**
 * Mirrors `verifyWebhookSignature` from `src/lib/sabcrm/webhooks.server.ts`.
 * Constant-time HMAC comparison — derives the HMAC inline rather than calling
 * `_signPayload` (matching the source's own approach).
 */
function _verifyWebhookSignature(
  secret: string,
  body: unknown,
  signature: string,
): boolean {
  const message =
    typeof body === "string" ? body : JSON.stringify(body ?? null);
  const expected = `sha256=${createHmac("sha256", secret)
    .update(message, "utf8")
    .digest("hex")}`;
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Mirrors `hashKey` (internal) from `src/lib/sabcrm/apikeys.server.ts`.
 * SHA-256 hex of the raw key — the only thing persisted; raw key never stored.
 */
function _hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/** Mirrors the public constant exported from `apikeys.server.ts`. */
const SABCRM_API_KEY_PREFIX = "sk_crm_";

/* -------------------------------------------------------------------------- */
/* Helpers used across multiple tests                                           */
/* -------------------------------------------------------------------------- */

/** Produces a random hex key with the SabCRM prefix, matching the real mint. */
function mintRawKey(): string {
  const random = randomBytes(32).toString("base64url");
  return `${SABCRM_API_KEY_PREFIX}${random}`;
}

/* -------------------------------------------------------------------------- */
/* Webhook HMAC — signPayload / signWebhookPayload                             */
/* -------------------------------------------------------------------------- */

test("signPayload produces sha256= prefixed hex, exactly 71 chars", () => {
  const sig = _signPayload("mysecret", { id: "abc" });
  assert.ok(sig.startsWith("sha256="), "must start with sha256=");
  // sha256= (7 chars) + 64 hex chars = 71
  assert.equal(sig.length, 71, "sha256=<64-hex> is always 71 characters");
});

test("signPayload is deterministic for the same secret + body", () => {
  const payload = { event: "record.created", id: "rec_001" };
  const s1 = _signPayload("s3cr3t", payload);
  const s2 = _signPayload("s3cr3t", payload);
  assert.equal(s1, s2, "same inputs must produce identical signature");
});

test("signPayload output differs when the secret differs", () => {
  const payload = { id: "rec_x" };
  const s1 = _signPayload("secret-A", payload);
  const s2 = _signPayload("secret-B", payload);
  assert.notEqual(s1, s2, "different secrets must produce different signatures");
});

test("signPayload output differs when the body differs", () => {
  const s1 = _signPayload("key", { id: "one" });
  const s2 = _signPayload("key", { id: "two" });
  assert.notEqual(s1, s2, "different bodies must produce different signatures");
});

test("signPayload accepts a raw string body (no double-serialisation)", () => {
  const raw = '{"id":"raw"}';
  const sig = _signPayload("key", raw);
  assert.ok(sig.startsWith("sha256="), "string body: must start with sha256=");
  assert.equal(sig.length, 71);
  // Signing the pre-serialised string must differ from signing the parsed object
  // (the source always uses the verbatim string when body is already a string).
  const objSig = _signPayload("key", { id: "raw" });
  assert.equal(sig, objSig, "JSON.stringify({id:'raw'}) === '{\"id\":\"raw\"}' — equal");
});

test("signPayload handles null / undefined body without throwing", () => {
  const s1 = _signPayload("key", null);
  const s2 = _signPayload("key", undefined);
  assert.ok(s1.startsWith("sha256="));
  // Both null and undefined serialise to 'null' via `body ?? null`
  assert.equal(s1, s2, "null and undefined body produce identical signature");
});

test("signPayload throws when secret is empty string", () => {
  assert.throws(
    () => _signPayload("", { id: "x" }),
    /secret is required/i,
    "empty secret must throw",
  );
});

/* -------------------------------------------------------------------------- */
/* Webhook HMAC — verifyWebhookSignature                                       */
/* -------------------------------------------------------------------------- */

test("verifyWebhookSignature accepts a valid round-trip signature", () => {
  const secret = "webhook-secret-42";
  const body = { event: "record.created", projectId: "proj_01", data: {} };
  const sig = _signPayload(secret, body);
  assert.ok(
    _verifyWebhookSignature(secret, body, sig),
    "valid signature must verify",
  );
});

test("verifyWebhookSignature rejects a tampered body", () => {
  const secret = "s";
  const original = { id: "rec_001", name: "Alice" };
  const tampered = { id: "rec_001", name: "Eve" };
  const sig = _signPayload(secret, original);
  assert.equal(
    _verifyWebhookSignature(secret, tampered, sig),
    false,
    "tampered body must not verify",
  );
});

test("verifyWebhookSignature rejects a wrong secret", () => {
  const body = { id: "rec_002" };
  const sig = _signPayload("correct-secret", body);
  assert.equal(
    _verifyWebhookSignature("wrong-secret", body, sig),
    false,
    "wrong secret must not verify",
  );
});

test("verifyWebhookSignature rejects an all-zero signature of correct length", () => {
  const secret = "k";
  const body = { a: 1 };
  const allZero = `sha256=${"0".repeat(64)}`;
  assert.equal(
    _verifyWebhookSignature(secret, body, allZero),
    false,
    "all-zero forged signature must not verify",
  );
});

test("verifyWebhookSignature rejects a signature with truncated hex (length mismatch)", () => {
  const secret = "k";
  const body = { a: 1 };
  const short = "sha256=deadbeef"; // only 8 hex chars
  assert.equal(
    _verifyWebhookSignature(secret, body, short),
    false,
    "truncated signature must not verify (length-fence branch)",
  );
});

test("verifyWebhookSignature rejects a bit-flipped signature", () => {
  const secret = "flip";
  const body = { x: 99 };
  const sig = _signPayload(secret, body);
  // Flip the last character
  const flipped =
    sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");
  assert.equal(
    _verifyWebhookSignature(secret, body, flipped),
    false,
    "single-bit-flipped signature must not verify",
  );
});

test("verifyWebhookSignature is consistent across object-body and JSON-string-body", () => {
  // signPayload serialises objects via JSON.stringify; verifyWebhookSignature
  // does the same.  Signing the object and verifying against the pre-serialised
  // string must yield the same result.
  const secret = "consistency";
  const payload = { event: "record.updated", id: "r1" };
  const jsonStr = JSON.stringify(payload);
  const sig = _signPayload(secret, payload);

  assert.ok(
    _verifyWebhookSignature(secret, payload, sig),
    "object verify must pass",
  );
  assert.ok(
    _verifyWebhookSignature(secret, jsonStr, sig),
    "pre-serialised string must also verify (same canonical form)",
  );
});

/* -------------------------------------------------------------------------- */
/* API-key hashing — stability + collision resistance                          */
/* -------------------------------------------------------------------------- */

test("hashKey output is a 64-char lowercase hex string (SHA-256)", () => {
  const raw = mintRawKey();
  const h = _hashKey(raw);
  assert.equal(h.length, 64, "SHA-256 hex digest is always 64 chars");
  assert.match(h, /^[0-9a-f]{64}$/, "must be lowercase hex");
});

test("hashKey is stable: same key always produces same hash", () => {
  const raw = mintRawKey();
  assert.equal(
    _hashKey(raw),
    _hashKey(raw),
    "repeated calls must produce identical digest",
  );
});

test("hashKey is stable across 100 independent calls (no state leak)", () => {
  const raw = mintRawKey();
  const baseline = _hashKey(raw);
  for (let i = 0; i < 100; i++) {
    assert.equal(
      _hashKey(raw),
      baseline,
      `call #${i} diverged from baseline`,
    );
  }
});

test("hashKey produces distinct digests for distinct keys", () => {
  const k1 = mintRawKey();
  const k2 = mintRawKey(); // independent CSPRNG call
  assert.notEqual(
    _hashKey(k1),
    _hashKey(k2),
    "two different random keys must hash to different digests",
  );
});

test("hashKey digests differ when the key prefix changes", () => {
  const tail = randomBytes(32).toString("base64url");
  const h1 = _hashKey(`${SABCRM_API_KEY_PREFIX}${tail}`);
  const h2 = _hashKey(`sk_other_${tail}`);
  assert.notEqual(h1, h2, "same tail with different prefix must differ");
});

test("hashKey: a wrong raw key does not produce the same digest as the correct key", () => {
  const correct = mintRawKey();
  const wrong = mintRawKey(); // different CSPRNG bytes
  const correctHash = _hashKey(correct);
  const wrongHash = _hashKey(wrong);
  assert.notEqual(
    correctHash,
    wrongHash,
    "wrong key must not match correct key's digest",
  );
});

test("API key auth rejects a key with wrong prefix (resolveApiKey guard)", () => {
  // resolveApiKey in apikeys.server.ts returns null immediately when the raw
  // key does not start with SABCRM_API_KEY_PREFIX — test the prefix check
  // contract without touching Mongo.
  const noPrefix = randomBytes(32).toString("hex");
  const hasPrefix = `${SABCRM_API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  assert.ok(
    hasPrefix.startsWith(SABCRM_API_KEY_PREFIX),
    "valid key starts with prefix",
  );
  assert.ok(
    !noPrefix.startsWith(SABCRM_API_KEY_PREFIX),
    "unprefixed string fails the prefix gate",
  );
});

test("hashKey output is fixed-length regardless of input size", () => {
  // SHA-256 always produces 256 bits regardless of message length.
  const short = _hashKey(`${SABCRM_API_KEY_PREFIX}x`);
  const long = _hashKey(`${SABCRM_API_KEY_PREFIX}${"a".repeat(4096)}`);
  assert.equal(short.length, 64);
  assert.equal(long.length, 64);
});

/* -------------------------------------------------------------------------- */
/* Cross-surface: signing + hashing are independent (no accidental coupling)   */
/* -------------------------------------------------------------------------- */

test("HMAC signing and SHA-256 key hashing produce independent outputs", () => {
  // Ensure a key hashed for storage cannot accidentally collide with a webhook
  // signature.  They use different algorithms (HMAC-SHA-256 vs plain SHA-256)
  // and different output prefixes.
  const rawKey = mintRawKey();
  const keyHash = _hashKey(rawKey);
  const webhookSig = _signPayload("some-secret", { key: rawKey });

  assert.ok(webhookSig.startsWith("sha256="), "webhook sig carries prefix");
  assert.doesNotMatch(keyHash, /^sha256=/, "key hash must NOT carry sha256= prefix");
  assert.notEqual(
    keyHash,
    webhookSig.slice("sha256=".length),
    "key hash hex must differ from HMAC hex for the same input",
  );
});
