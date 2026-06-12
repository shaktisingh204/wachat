/**
 * SabSMS — GSM-7 / UCS-2 segment counter (engine parity module).
 *
 * EXACT TypeScript mirror of the Rust engine's billing math in
 * `services/sabsms-engine/src/providers/mod.rs` (`estimate_segments` +
 * `is_gsm7_char`). Both sides are pinned to the shared test vectors at
 * `services/sabsms-engine/tests/fixtures/segment-vectors.json` — the
 * anti-drift artifact consumed by BOTH `cargo test` and
 * `npx tsx --test src/lib/sabsms/__tests__/segments.test.ts`.
 *
 * Parity rules (do not "fix" these here without changing the engine):
 *   - Lengths are Unicode CODE POINTS (`chars().count()` in Rust,
 *     `[...body].length` here) — NOT UTF-16 units, NOT septets.
 *   - GSM-7 splits at 160, then `ceil(len / 153)`.
 *   - UCS-2 splits at 70, then `ceil(len / 67)`.
 *   - GSM extension chars (€ [ ] { } ~ ^ | \) count as ONE char — the
 *     engine deliberately skips the 2-septet escape cost ("close-enough
 *     for billing"); mirror that.
 *   - The empty string is GSM-7 and bills 1 segment (Rust: `all()` on an
 *     empty iterator is true, `0 <= 160` → 1).
 *
 * Pure module — safe to import from client components and server code.
 */

export type SabsmsEncoding = 'gsm7' | 'ucs2';

export interface SegmentInfo {
  encoding: SabsmsEncoding;
  /** Body length in Unicode code points. */
  length: number;
  /** Segments the carrier will bill for (engine-parity math). */
  segments: number;
  /** Per-segment capacity at the current segment count. */
  perSegment: number;
}

/**
 * Core GSM-7 alphabet + the extension table, exactly as enumerated in
 * the engine's `is_gsm7_char` `matches!` arm. Anything else triggers a
 * UCS-2 fallback.
 */
const GSM7_SINGLE_CHARS = new Set<string>([
  '@', '£', '$', '¥', 'è', 'é', 'ù', 'ì', 'ò', 'Ç',
  '\n', 'Ø', 'ø', '\r', 'Å', 'å', '_', 'Æ', 'æ', 'ß', 'É',
  ' ', '!', '"', '#', '%', '&', "'",
  '(', ')', '*', '+', ',', '-', '.', '/',
  ':', ';', '<', '=', '>', '?',
  'Ä', 'Ö', 'Ñ', 'Ü', '§',
  '¡', 'ä', 'ö', 'ñ', 'ü', 'à',
  '|', '^', '{', '}', '\\', '[', '~', ']', '€',
]);

/** Mirror of `is_gsm7_char` — one Unicode code point in, boolean out. */
export function isGsm7Char(c: string): boolean {
  if (GSM7_SINGLE_CHARS.has(c)) return true;
  // Ranges: '0'..='9' | 'A'..='Z' | 'a'..='z'
  return (
    (c >= '0' && c <= '9') ||
    (c >= 'A' && c <= 'Z') ||
    (c >= 'a' && c <= 'z')
  );
}

/** True when every code point of `body` fits the GSM-7 set (empty → true). */
export function isGsm7(body: string): boolean {
  for (const c of body) {
    if (!isGsm7Char(c)) return false;
  }
  return true;
}

/**
 * Mirror of `estimate_segments` — the number of SMS segments the
 * carrier will bill for. The split sizes are universal: 160/153 for
 * GSM-7, 70/67 for UCS-2. Empty body returns 1 (engine parity).
 */
export function estimateSegments(body: string): number {
  const len = [...body].length; // code points, like Rust chars().count()
  if (isGsm7(body)) {
    return len <= 160 ? 1 : Math.ceil(len / 153);
  }
  return len <= 70 ? 1 : Math.ceil(len / 67);
}

/** Structured counter for UI counters / cost estimates. */
export function segmentInfo(body: string): SegmentInfo {
  const length = [...body].length;
  const gsm = isGsm7(body);
  const encoding: SabsmsEncoding = gsm ? 'gsm7' : 'ucs2';
  const segments = gsm
    ? length <= 160
      ? 1
      : Math.ceil(length / 153)
    : length <= 70
      ? 1
      : Math.ceil(length / 67);
  const perSegment = gsm ? (segments <= 1 ? 160 : 153) : segments <= 1 ? 70 : 67;
  return { encoding, length, segments, perSegment };
}
