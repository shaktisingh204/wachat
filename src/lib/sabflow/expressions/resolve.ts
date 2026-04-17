/**
 * Top-level expression resolution API for SabFlow.
 *
 * Two entry points:
 *
 *   resolveExpression(raw, ctx)
 *     Evaluates a SINGLE expression.  Accepts either:
 *       - "{{ $json.foo.bar }}"   (wrapped, for convenience)
 *       - "$json.foo.bar"          (naked, for callers that already stripped braces)
 *     Returns `{ value, error? }`.
 *
 *   resolveTemplate(template, ctx)
 *     Scans `template` for `{{ ... }}` expressions and substitutes each
 *     with the stringified evaluation result.  Non-expression text is passed
 *     through verbatim.  If an expression errors, the original token is left
 *     intact (failing-safe behaviour).
 *
 * Backward-compat: a bare `{{ variableName }}` resolves via the evaluator's
 * identifier fallback — which first checks `context.vars[variableName]` — so
 * existing Typebot flows continue to work.
 */

import { tokenize, TokenizerError } from './tokenizer';
import { parse, ParseError } from './parser';
import { evaluate, coerceToString } from './evaluator';
import type { ExpressionContext, ExpressionResult } from './types';

/** Strip a leading `{{` / trailing `}}` if present. */
function stripBraces(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) {
    return trimmed.slice(2, -2);
  }
  return trimmed;
}

export function resolveExpression(
  input: string,
  context: ExpressionContext,
): ExpressionResult {
  const source = stripBraces(input);
  if (source.length === 0) {
    return { value: '' };
  }
  try {
    const tokens = tokenize(source);
    const ast = parse(tokens);
    return evaluate(ast, context);
  } catch (err) {
    if (err instanceof TokenizerError || err instanceof ParseError) {
      return { value: undefined, error: err.message };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { value: undefined, error: msg };
  }
}

/**
 * Replace every `{{ ... }}` token in `template` with its stringified result.
 *
 * Rules:
 *   - Bracketed spans are extracted greedily but DO NOT span across unbalanced
 *     quotes — so `"{{ foo }}"` inside a JSON template resolves correctly.
 *   - When the span itself is the entire template (e.g. `{{ $json.foo }}` and
 *     nothing else), the raw value is stringified naturally — objects become
 *     `JSON.stringify(...)`; `null`/`undefined` become `""`.
 *   - On error, the original `{{...}}` token is left in place.
 */
export function resolveTemplate(
  template: string,
  context: ExpressionContext,
): string {
  if (!template || template.indexOf('{{') === -1) return template;

  let out = '';
  let i = 0;
  while (i < template.length) {
    // Look for an opening `{{`
    if (template[i] === '{' && template[i + 1] === '{') {
      const end = findClosingBraces(template, i + 2);
      if (end === -1) {
        // unterminated — copy remaining chars literally
        out += template.slice(i);
        break;
      }
      const inner = template.slice(i + 2, end);
      const result = resolveExpression(inner, context);
      if (result.error !== undefined) {
        // Fail-safe: keep the original token so authors can debug
        out += template.slice(i, end + 2);
      } else {
        out += coerceToString(result.value);
      }
      i = end + 2;
      continue;
    }
    out += template[i];
    i++;
  }
  return out;
}

/**
 * Finds the index of the closing `}}` that matches an opening `{{`.
 * Tracks quote state to avoid early-closing inside string literals.
 */
function findClosingBraces(src: string, from: number): number {
  let i = from;
  let quote: string | null = null;
  while (i < src.length) {
    const ch = src[i];
    if (quote !== null) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === quote) { quote = null; i++; continue; }
      i++;
      continue;
    }
    if (ch === '"' || ch === '\'' || ch === '`') {
      quote = ch;
      i++;
      continue;
    }
    if (ch === '}' && src[i + 1] === '}') return i;
    i++;
  }
  return -1;
}
