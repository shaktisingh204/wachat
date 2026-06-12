/**
 * SabSMS — DLT template-marker helpers (V2.12, pure).
 *
 * India DLT templates use `{#var#}` placeholders that MUST survive any
 * AI rewrite verbatim (the operator matches the registered template
 * literally). The composer copy-assist instructs the model to keep
 * them and then validates post-hoc with `markersPreserved` — a rewrite
 * that adds, drops, or mangles a marker is rejected.
 *
 * Also matches named forms like `{#name#}` defensively.
 *
 * Worker-safe: pure, zero imports.
 */

const MARKER_RX = /\{#\s*[A-Za-z0-9_]*\s*#\}/g;

/** All DLT markers in `text`, in order (e.g. `["{#var#}", "{#var#}"]`). */
export function extractDltMarkers(text: string): string[] {
  return text.match(MARKER_RX) ?? [];
}

/** True when `text` contains at least one DLT marker. */
export function hasDltMarkers(text: string): boolean {
  MARKER_RX.lastIndex = 0;
  return MARKER_RX.test(text);
}

/**
 * Validate that a rewrite preserved every marker exactly: same
 * multiset of marker strings (order may change — a translation can
 * legitimately reorder sentence parts, but nothing may be added,
 * dropped, or altered).
 */
export function markersPreserved(original: string, rewritten: string): boolean {
  const a = extractDltMarkers(original);
  const b = extractDltMarkers(rewritten);
  if (a.length !== b.length) return false;
  const count = new Map<string, number>();
  for (const m of a) count.set(m, (count.get(m) ?? 0) + 1);
  for (const m of b) {
    const left = (count.get(m) ?? 0) - 1;
    if (left < 0) return false;
    count.set(m, left);
  }
  return true;
}
