/**
 * SabCRM — fractional ranking (LexoRank / Figma-style) — PURE helpers.
 *
 * The structural twin of `./scoring.ts`: a `'server-only'`- and I/O-free module
 * so the unit tests (`tsx --test`) AND any `'use client'` board can import the
 * key-generation math directly. The Mongo write-back lives in `./ranking.server.ts`,
 * which re-exports everything here.
 *
 * ## Why fractional keys
 *
 * A kanban board lets a user drag a card to ANY position. Storing an integer
 * `position` means every card after the drop point has to be renumbered — an
 * O(n) write storm on every move. A fractional rank instead stores a SHORT
 * lexicographically-ordered string per card; to drop a card between two
 * neighbours you only mint ONE new key that sorts strictly between their two
 * keys, and write that single field. No neighbour is touched.
 *
 * The keys are compared as plain strings (Mongo `sort({ 'data.__rank': 1 })`),
 * so the board sorts by `data.__rank` ascending and never re-reads integers.
 *
 * ## Encoding
 *
 * Keys are strings over the base-62 alphabet {@link DIGITS} (`0-9A-Za-z`, which
 * is itself in strict ASCII order, so byte-order === alphabet-order). A key is
 * read as a fraction in `(0, 1)` written in base 62 (an implicit leading
 * radix-point): `"V"` ≈ 0.5, `"1"` is small, `"z"` is large. {@link midpoint}
 * finds a string that sorts strictly between two bounds, lengthening the key
 * only when no single digit fits between them — so keys grow by ~1 char per
 * ~62 consecutive same-position inserts, not per insert.
 *
 * This is the classic Figma/Steve-Wittens "fractional indexing" scheme; we keep
 * it dependency-free and self-contained (HARD RULE: in-house only).
 */

/**
 * Base-62 alphabet in strict ASCII / byte order. Crucially `'0' < … < '9' <
 * 'A' < … < 'Z' < 'a' < … < 'z'` as raw bytes, so a JS string `<` comparison of
 * two keys agrees with Mongo's default collation on these characters.
 */
export const DIGITS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Numeric base of {@link DIGITS}. */
export const BASE = DIGITS.length; // 62

/** Smallest digit (`'0'`) and largest digit (`'z'`). */
const MIN_DIGIT = DIGITS[0];
const MAX_DIGIT = DIGITS[BASE - 1];

/** Index of a digit char in {@link DIGITS}; -1 when not a base-62 digit. */
function digitIndex(ch: string): number {
  return DIGITS.indexOf(ch);
}

/**
 * Validate that `key` is a non-empty base-62 string that does NOT end in the
 * smallest digit (a trailing `'0'` is redundant — `"V0"` === `"V"` as a
 * fraction — and would let two distinct strings denote the same position,
 * breaking strict ordering). Generated keys always satisfy this; we tolerate
 * (re-normalise around) stored keys that don't.
 */
export function isValidKey(key: string): boolean {
  if (typeof key !== 'string' || key.length === 0) return false;
  for (const ch of key) {
    if (digitIndex(ch) < 0) return false;
  }
  return key[key.length - 1] !== MIN_DIGIT;
}

/**
 * The midpoint string strictly between bounds `a` and `b`, where `a < b` are
 * either base-62 keys or the implicit endpoints `''` (→ 0) and `null` (→ 1).
 *
 * Walks the two keys digit by digit. While the digits are equal the result
 * copies them. At the first position where they differ (treating a short key as
 * padded with the smallest digit, and a missing upper bound as padded with the
 * largest), if there is a free digit strictly between them we place it and stop;
 * otherwise we copy the lower digit and descend one place deeper (appending),
 * which always succeeds because there is infinite room below any digit.
 *
 * @param a lower bound key, or `''` for "before everything" (fraction 0).
 * @param b upper bound key, or `null` for "after everything" (fraction 1).
 * @returns a key `k` with `a < k < b` (string comparison), trimmed of any
 *   redundant trailing smallest-digit.
 */
function midpoint(a: string, b: string | null): string {
  let out = '';
  let i = 0;
  // Phase 1: copy the shared prefix where both digits are equal.
  for (;;) {
    const da = i < a.length ? digitIndex(a[i]) : 0;
    const db = b !== null && i < b.length ? digitIndex(b[i]) : BASE;
    if (da === db) {
      // Equal digit (or both at the same implicit pad): copy and continue.
      out += DIGITS[da] ?? MIN_DIGIT;
      i += 1;
      continue;
    }
    // Phase 2: first differing position.
    if (db - da > 1) {
      // Room for a digit strictly between them — place the true middle.
      const mid = da + Math.floor((db - da) / 2);
      return trimKey(out + DIGITS[mid]);
    }
    // Adjacent digits (db === da + 1): no room here. Keep the lower digit and
    // descend below it — the rest of `a` (from i+1) plus a digit guaranteed to
    // sit above whatever `a` continues with.
    out += DIGITS[da];
    return trimKey(out + below(a.slice(i + 1)));
  }
}

/**
 * A digit string strictly greater than the (possibly empty) suffix `rest`,
 * appended below the current position. We pick the digit halfway between
 * `rest`'s first digit (or the minimum, when `rest` is empty) and the maximum,
 * then descend again if that lands exactly on `rest`'s lead digit.
 */
function below(rest: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const lead = i < rest.length ? digitIndex(rest[i]) : 0;
    // Halfway between `lead` (exclusive lower) and BASE (exclusive upper).
    if (BASE - 1 - lead >= 1) {
      const mid = lead + Math.ceil((BASE - lead) / 2);
      if (mid > lead && mid < BASE) {
        return out + DIGITS[mid];
      }
    }
    // `lead` is the max digit (or no gap above it) — copy it and go deeper.
    out += DIGITS[lead];
    i += 1;
  }
}

/** Strip any redundant trailing smallest-digit; never returns the empty string. */
function trimKey(key: string): string {
  let end = key.length;
  while (end > 1 && key[end - 1] === MIN_DIGIT) end -= 1;
  const trimmed = key.slice(0, end);
  return trimmed.length > 0 ? trimmed : MAX_DIGIT;
}

/**
 * Generate a key that sorts strictly BETWEEN `a` and `b` (both `null`-able).
 *
 *   - `generateKeyBetween(null, null)` → a mid key for the first item.
 *   - `generateKeyBetween(a, null)`    → a key after `a` (append to the end).
 *   - `generateKeyBetween(null, b)`    → a key before `b` (prepend to the start).
 *   - `generateKeyBetween(a, b)`       → a key between two existing neighbours.
 *
 * Invalid / out-of-order bounds are normalised defensively: a non-base-62 bound
 * is treated as absent, and if `a >= b` after coercion the upper bound is
 * dropped (so the result still sorts after `a`) — a drop should never throw.
 *
 * @throws never. Always returns a valid non-empty base-62 key.
 */
export function generateKeyBetween(
  a: string | null,
  b: string | null,
): string {
  const lower = a != null && isValidKey(a) ? a : '';
  let upper = b != null && isValidKey(b) ? b : null;

  // Defensive: if the bounds are crossed or equal, ignore the upper bound so we
  // still produce a key after `lower` rather than looping/throwing.
  if (upper !== null && lower !== '' && lower >= upper) {
    upper = null;
  }

  if (lower === '' && upper === null) {
    // Empty list — middle of the (0,1) space.
    return DIGITS[Math.floor(BASE / 2)];
  }
  if (lower === '') {
    // Before `upper`: midpoint between 0 and upper.
    return midpoint('', upper);
  }
  if (upper === null) {
    // After `lower`: midpoint between lower and 1.
    return midpoint(lower, null);
  }
  return midpoint(lower, upper);
}

/**
 * Generate `n` keys strictly between `a` and `b`, each strictly ordered. Used to
 * rank a whole batch (e.g. backfill / bulk insert) without n round-trips of
 * pairwise calls. Returns `[]` for `n <= 0`.
 */
export function generateNKeysBetween(
  a: string | null,
  b: string | null,
  n: number,
): string[] {
  if (n <= 0) return [];
  if (n === 1) return [generateKeyBetween(a, b)];
  // Bisect: mint the middle key, then recurse into the two halves. Balanced so
  // the keys stay short.
  const mid = generateKeyBetween(a, b);
  const half = Math.floor(n / 2);
  const left = generateNKeysBetween(a, mid, half);
  const right = generateNKeysBetween(mid, b, n - half - 1);
  return [...left, mid, ...right];
}

/** An item carrying an (optional / possibly invalid) rank key. */
export interface Rankable {
  id: string;
  rank?: string | null;
}

/** An `{ id, rank }` assignment produced by {@link rebalance}. */
export interface RankAssignment {
  id: string;
  rank: string;
}

/**
 * Rebalance a list into evenly-spaced fresh keys, preserving the list's CURRENT
 * order. Use this (a) to backfill items that have no rank yet, and (b) to reset
 * keys that have grown long after many same-slot inserts. The input order is
 * authoritative — sort the list however the board displays it BEFORE calling.
 *
 * Returns one {@link RankAssignment} per input item (same order); the caller
 * decides which to persist (e.g. only those whose rank actually changed).
 * Pure + deterministic.
 */
export function rebalance(list: Rankable[]): RankAssignment[] {
  if (!Array.isArray(list) || list.length === 0) return [];
  const keys = generateNKeysBetween(null, null, list.length);
  return list.map((item, i) => ({ id: item.id, rank: keys[i] }));
}

/**
 * Sort a list of {@link Rankable}s by their rank key ascending. Items missing a
 * valid key sort LAST (stable, by their incoming order) so an un-ranked record
 * never jumps to the top of the board. Returns a new array; does not mutate.
 */
export function sortByRank<T extends Rankable>(list: T[]): T[] {
  return list
    .map((item, i) => ({ item, i }))
    .sort((x, y) => {
      const rx = x.item.rank;
      const ry = y.item.rank;
      const vx = rx != null && isValidKey(rx);
      const vy = ry != null && isValidKey(ry);
      if (vx && vy) return rx! < ry! ? -1 : rx! > ry! ? 1 : x.i - y.i;
      if (vx) return -1;
      if (vy) return 1;
      return x.i - y.i;
    })
    .map((w) => w.item);
}
