import { evaluateExpression } from '@/lib/sabflow/n8n/expression-runner';

/** Bare-identifier placeholder regex: `{{ name }}` with no `$` / `.` / `(`. */
const BARE_PLACEHOLDER = /\{\{\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\}\}/g;

/** True when at least one `{{ ... }}` placeholder is something richer
 *  than a bare identifier (i.e. uses `$`, dot-access, calls, arithmetic). */
function hasRicherExpression(text: string): boolean {
  let m: RegExpExecArray | null;
  const re = /\{\{([^}]+)\}\}/g;
  while ((m = re.exec(text))) {
    const inner = m[1];
    if (/[$.()+\-*/<>!&|?:%]/.test(inner)) return true;
  }
  return false;
}

/**
 * Replaces `{{ ... }}` placeholders in a string.
 *
 * Two-tier behaviour, picked per placeholder so existing sabflow templates
 * keep working while new ones get the n8n expression engine:
 *   1. **Bare identifier** (`{{ name }}`, no `$`/`.`/operator) — direct
 *      lookup in `variables`. Unknown names are left untouched (legacy
 *      sabflow behaviour).
 *   2. **Anything richer** (`{{ $json.foo }}`, `{{ a + b }}`,
 *      `{{ $now.toFormat('yyyy') }}`) — handed to n8n's `Expression`
 *      engine. Result is stringified; failures fall back to leaving the
 *      placeholder verbatim.
 */
export function substituteVariables(
  text: string,
  variables: Record<string, string | undefined>,
): string {
  if (!text) return text;
  if (!text.includes('{{')) return text;

  // First pass: substitute bare identifiers using the variables map.
  let out = text.replace(BARE_PLACEHOLDER, (match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(variables, name)) {
      const v = variables[name];
      return v ?? '';
    }
    return match; // unknown — leave as-is
  });

  // Second pass: anything still wrapped in `{{ ... }}` is either an
  // unresolved bare identifier (leave untouched — legacy) or a richer
  // expression that we hand to n8n.
  if (!out.includes('{{')) return out;
  if (!hasRicherExpression(out)) return out;

  try {
    const ctx: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(variables)) {
      if (v !== undefined) ctx[k] = v;
    }
    const result = evaluateExpression(out, { json: ctx, variables: ctx });
    if (typeof result === 'string') {
      out = result;
    } else if (result !== undefined && result !== null) {
      out = String(result);
    }
  } catch {
    // Leave placeholders as-is on evaluator failure.
  }
  return out;
}
