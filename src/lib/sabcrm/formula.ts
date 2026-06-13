/**
 * SabCRM — formula fields — PURE evaluator.
 *
 * `'server-only'`- and I/O-free (unit-testable). Evaluates a spreadsheet-style
 * expression over a record's sibling fields using the installed
 * `expr-eval-fork` (the same parser the vendored Twenty command-menu uses).
 * The Mongo persistence + recompute live in `./formula.server.ts`.
 *
 * Variables in the expression are sibling field KEYS, e.g. `amount * 0.1` or
 * `quantity * unitPrice`. NUMBER is the primary output; BOOLEAN/TEXT are
 * best-effort. The computed value is stored as a plain scalar at
 * `data[field.key]` (recompute metadata at `data.__formula.<key>`), so the
 * records engine renders/filters/sorts it with zero change — same envelope as
 * AI + scoring fields.
 */

import { Parser } from 'expr-eval-fork';

/** What a formula produces (drives coercion + display). */
export type FormulaOutputType = 'NUMBER' | 'TEXT' | 'BOOLEAN';

/** A formula definition attached to a field. */
export interface FormulaSpec {
  expression: string;
  outputType: FormulaOutputType;
}

/** Outcome of one evaluation. */
export interface FormulaResult {
  ok: boolean;
  value?: unknown;
  error?: string;
}

// Single shared parser (stateless across parse() calls).
const parser = new Parser();

/** Field keys referenced by the expression (the recompute inputs). */
export function formulaVariables(expression: string): string[] {
  try {
    return parser.parse(expression).variables();
  } catch {
    return [];
  }
}

/** Coerce a raw record value into a number for arithmetic (NaN → 0). */
function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of ['amount', 'value', 'amountMicros']) {
      const c = o[k];
      if (typeof c === 'number') return k === 'amountMicros' ? c / 1_000_000 : c;
    }
  }
  return 0;
}

/**
 * Evaluate a formula against a record's `data`. Variables are resolved from
 * sibling fields (numeric-coerced for NUMBER/BOOLEAN; raw-stringy for TEXT).
 * Never throws — parse/eval failures return `{ ok:false, error }`.
 */
export function evaluateFormula(
  spec: FormulaSpec,
  data: Record<string, unknown>,
): FormulaResult {
  if (!spec?.expression?.trim()) {
    return { ok: false, error: 'empty expression' };
  }
  try {
    const expr = parser.parse(spec.expression);
    const vars = expr.variables();
    const scope: Record<string, unknown> = {};
    for (const v of vars) {
      const raw = data?.[v];
      scope[v] =
        spec.outputType === 'TEXT'
          ? raw === null || raw === undefined
            ? ''
            : typeof raw === 'object'
              ? num(raw)
              : raw
          : num(raw);
    }
    const result = expr.evaluate(scope as Record<string, number>);
    return coerceFormulaOutput(result, spec.outputType);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'formula error' };
  }
}

/** Coerce the raw eval result by output type. Pure — callers persist. */
export function coerceFormulaOutput(
  raw: unknown,
  outputType: FormulaOutputType,
): FormulaResult {
  switch (outputType) {
    case 'NUMBER': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(n)) return { ok: false, error: 'not a finite number' };
      return { ok: true, value: Math.round(n * 1e6) / 1e6 };
    }
    case 'BOOLEAN':
      return { ok: true, value: Boolean(raw) };
    case 'TEXT':
    default:
      return { ok: true, value: raw === null || raw === undefined ? '' : String(raw) };
  }
}
