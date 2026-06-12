/**
 * SabSMS — template renderer + variable extraction.
 *
 * Two variable syntaxes are supported in the same body:
 *
 *   1. Named:      `{{name}}` — keys are trimmed; an optional fallback
 *                  follows a pipe: `{{name|fallback text}}`.
 *   2. Positional: `{#var#}` — the India DLT placeholder. Slots are
 *                  filled IN ORDER from `opts.positional`.
 *
 * Resolution rules:
 *   - A named var resolves from `vars[key]`; `null`/`undefined` count
 *     as absent. Numbers are stringified (`0` renders as "0").
 *   - Absent + fallback → the fallback text is used (not "missing").
 *   - Absent + no fallback → the placeholder is kept LITERALLY in the
 *     output and the key is collected into `missing`.
 *   - A positional slot with no remaining `opts.positional` value is
 *     kept literally and reported in `missing` as `#<ordinal>` (1-based).
 *
 * Pure module — safe for client components, server actions, and tests.
 */

export interface RenderOptions {
  /** Values for DLT-style `{#var#}` slots, consumed in document order. */
  positional?: Array<string | number | null | undefined>;
}

export interface RenderResult {
  text: string;
  /**
   * Named keys (and `#<n>` ordinals for unfilled positional slots) that
   * had no value and no fallback — their placeholders remain literal.
   */
  missing: string[];
}

export interface ExtractedVariables {
  /** Unique named variable keys, in order of first appearance. */
  named: string[];
  /** Number of DLT-style `{#var#}` slots. */
  positionalCount: number;
}

/** `{{ key }}` or `{{ key | fallback }}` — fallback may contain pipes. */
const NAMED_RE = /\{\{([^{}]*)\}\}/g;
/** DLT positional placeholder — tolerate inner whitespace. */
const POSITIONAL_RE = /\{#\s*var\s*#\}/gi;

function splitNamed(inner: string): { key: string; fallback: string | null } {
  const pipe = inner.indexOf('|');
  if (pipe === -1) return { key: inner.trim(), fallback: null };
  return {
    key: inner.slice(0, pipe).trim(),
    fallback: inner.slice(pipe + 1).trim(),
  };
}

export function extractVariables(body: string): ExtractedVariables {
  const named: string[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(NAMED_RE)) {
    const { key } = splitNamed(m[1]);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    named.push(key);
  }
  let positionalCount = 0;
  for (const _ of body.matchAll(POSITIONAL_RE)) positionalCount++;
  return { named, positionalCount };
}

export function renderTemplate(
  body: string,
  vars: Record<string, string | number | null | undefined>,
  opts?: RenderOptions,
): RenderResult {
  const missing: string[] = [];
  const missingSeen = new Set<string>();
  const markMissing = (key: string) => {
    if (missingSeen.has(key)) return;
    missingSeen.add(key);
    missing.push(key);
  };

  // Named vars (with optional `|fallback`).
  let text = body.replace(NAMED_RE, (whole, inner: string) => {
    const { key, fallback } = splitNamed(inner);
    if (!key) return whole; // `{{}}` / `{{ | x }}` — not a variable.
    const value = vars[key];
    if (value !== null && value !== undefined) return String(value);
    if (fallback !== null) return fallback;
    markMissing(key);
    return whole; // keep the literal placeholder
  });

  // DLT positional slots, consumed in order.
  let slot = 0;
  text = text.replace(POSITIONAL_RE, (whole) => {
    slot += 1;
    const value = opts?.positional?.[slot - 1];
    if (value !== null && value !== undefined) return String(value);
    markMissing(`#${slot}`);
    return whole;
  });

  return { text, missing };
}
