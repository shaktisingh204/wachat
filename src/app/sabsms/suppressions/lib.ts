/**
 * Pure helpers used by both the server actions in `./actions.ts` and
 * the unit tests under `./__tests__/hash.test.ts`.
 *
 * Kept in a non-"use server" module so Next.js doesn't try to wrap the
 * sync exports as async server actions — and so the test runner can
 * import them without dragging in Mongo / session.
 */

import { createHash } from "node:crypto";

/**
 * SHA-256 lowercase hex digest of an E.164 phone. The input is
 * trimmed + lowercased before hashing so equivalent phone strings
 * collide.
 */
export function hashPhone(e164: string): string {
  return createHash("sha256")
    .update(e164.trim().toLowerCase())
    .digest("hex");
}

/** True if the input is a 64-char lowercase hex string. */
export function isPhoneHash(s: string): boolean {
  return typeof s === "string" && /^[0-9a-f]{64}$/.test(s);
}

export type SearchTerm =
  | { kind: "hash"; hash: string }
  | { kind: "text"; text: string }
  | { kind: "empty" };

/**
 * Auto-detect: if input looks like a hex hash, treat as a hash; if it
 * starts with `+` or contains 7+ digits, hash it; otherwise it's a
 * free-text reason search.
 */
export function normalizeSearchTerm(
  input: string | undefined | null,
): SearchTerm {
  if (!input) return { kind: "empty" };
  const trimmed = input.trim();
  if (!trimmed) return { kind: "empty" };
  if (isPhoneHash(trimmed)) return { kind: "hash", hash: trimmed };
  const looksLikePhone =
    trimmed.startsWith("+") || /^\d[\d\s\-()]{6,}$/.test(trimmed);
  if (looksLikePhone) return { kind: "hash", hash: hashPhone(trimmed) };
  return { kind: "text", text: trimmed };
}
