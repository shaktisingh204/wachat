/**
 * SabFlow expression-evaluator type coercion.
 *
 * Mirrors n8n's Tournament Expression Sandbox (TES) coercion semantics so that
 * blocks authored against n8n expressions behave identically inside SabFlow's
 * executor.  Where TES diverges from raw JavaScript (e.g. `Number(undefined)`
 * is `NaN` but `Number('')` is `0`), we preserve the divergence rather than
 * the JS default — this is the documented behaviour and downstream blocks
 * (HTTP Request URL templating, Set node, IF node) depend on it.
 *
 * Public surface:
 *   - `coerce(value, targetKind)`            — single-value coercion
 *   - `coerceBinary(op, left, right)`        — `+` / `-` / `*` / `/`
 *   - `coerceEquality(op, left, right)`      — `==` / `===`
 *   - `CoerceError`                          — thrown on impossible coercions
 *
 * This module has zero runtime dependencies on the rest of SabFlow so it can
 * be unit-tested in isolation and reused by the future Rust binding layer.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CoerceKind = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date';

export class CoerceError extends Error {
  readonly kind: CoerceKind;
  readonly received: string;
  constructor(kind: CoerceKind, received: unknown) {
    super(`Cannot coerce ${describe(received)} to ${kind}`);
    this.name = 'CoerceError';
    this.kind = kind;
    this.received = describe(received);
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (Array.isArray(v)) return 'array';
  if (v instanceof Date) return 'date';
  return typeof v;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

// Strict ISO-8601 sniff — Date.parse will happily eat "12abc" on some
// engines, so we gate string→Date through this regex first.  Covers
// date, date-time, and offset forms.
const ISO_8601 =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

// ---------------------------------------------------------------------------
// Per-kind coercers
// ---------------------------------------------------------------------------

function toString_(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v) || isPlainObject(v)) {
    try {
      return JSON.stringify(v) ?? '';
    } catch {
      // Cyclic refs → fall back to native String(), which yields '[object Object]'.
      return String(v);
    }
  }
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function toNumber_(v: unknown): number {
  // n8n divergence from JS: `Number(undefined) === NaN` (kept),
  // but `Number(null) === 0` (kept), and `Number('') === 0` (kept).
  // The notable divergence is that an unset/missing field (undefined)
  // does NOT coerce to 0 — callers can detect this with isNaN.
  if (v === undefined) return Number.NaN;
  if (v === null) return 0;
  if (v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string') {
    // n8n: only fully-numeric strings convert; '12abc' → NaN.
    // We deliberately do NOT use parseFloat (which accepts trailing junk).
    const trimmed = v.trim();
    if (trimmed === '') return 0;
    const n = Number(trimmed);
    return Number.isFinite(n) || Number.isNaN(n) ? n : Number.NaN;
  }
  return Number.NaN;
}

function toBoolean_(v: unknown): boolean {
  // JS-parity — n8n uses the same falsy set.
  if (v === undefined || v === null) return false;
  if (typeof v === 'number') return v !== 0 && !Number.isNaN(v);
  if (typeof v === 'string') return v.length > 0;
  if (typeof v === 'boolean') return v;
  return true;
}

function toArray_(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  return [v];
}

function toObject_(v: unknown): Record<string, unknown> {
  if (isPlainObject(v)) return v;
  throw new CoerceError('object', v);
}

function toDate_(v: unknown): Date {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) throw new CoerceError('date', v);
    return v;
  }
  if (typeof v === 'number') {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw new CoerceError('date', v);
    return d;
  }
  if (typeof v === 'string' && ISO_8601.test(v.trim())) {
    const ms = Date.parse(v.trim());
    if (!Number.isNaN(ms)) return new Date(ms);
  }
  throw new CoerceError('date', v);
}

// ---------------------------------------------------------------------------
// Public: coerce
// ---------------------------------------------------------------------------

/**
 * Coerce `value` to `targetKind` using n8n TES rules.
 *
 * Throws `CoerceError` only for two impossible cases:
 *   - target=object on a non-object
 *   - target=date on a value that can't be parsed
 *
 * All other coercions return a best-effort value; callers that need
 * NaN-safety should check the result with `Number.isNaN` themselves.
 */
export function coerce(value: unknown, targetKind: 'string'): string;
export function coerce(value: unknown, targetKind: 'number'): number;
export function coerce(value: unknown, targetKind: 'boolean'): boolean;
export function coerce(value: unknown, targetKind: 'array'): unknown[];
export function coerce(value: unknown, targetKind: 'object'): Record<string, unknown>;
export function coerce(value: unknown, targetKind: 'date'): Date;
export function coerce(value: unknown, targetKind: CoerceKind): unknown {
  switch (targetKind) {
    case 'string':
      return toString_(value);
    case 'number':
      return toNumber_(value);
    case 'boolean':
      return toBoolean_(value);
    case 'array':
      return toArray_(value);
    case 'object':
      return toObject_(value);
    case 'date':
      return toDate_(value);
    /* c8 ignore next */
    default: {
      const _exhaustive: never = targetKind;
      throw new Error(`Unknown coerce kind: ${String(_exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Binary-op coercion
// ---------------------------------------------------------------------------

export type ArithOp = '+' | '-' | '*' | '/';

/**
 * Apply n8n-style coercion for an arithmetic binary op and return the result.
 *
 * `+`  — if either side is a string, both are stringified and concatenated;
 *        otherwise both sides go through `toNumber_` and are added.
 * `-` `*` `/` — both sides are force-coerced to number.
 *
 * Division by zero follows IEEE-754 (returns +Infinity / -Infinity / NaN).
 */
export function coerceBinary(op: ArithOp, left: unknown, right: unknown): string | number {
  if (op === '+') {
    if (typeof left === 'string' || typeof right === 'string') {
      return toString_(left) + toString_(right);
    }
    return toNumber_(left) + toNumber_(right);
  }
  const l = toNumber_(left);
  const r = toNumber_(right);
  switch (op) {
    case '-':
      return l - r;
    case '*':
      return l * r;
    case '/':
      return l / r;
  }
}

// ---------------------------------------------------------------------------
// Equality coercion
// ---------------------------------------------------------------------------

export type EqOp = '==' | '===' | '!=' | '!==';

/**
 * `===` / `!==` — strict, never coerce.
 * `==`  / `!=`  — JS abstract-equality semantics PLUS the SabFlow override
 *                 that `0 == ''` is **false** (n8n parity per TES).
 *
 * The override applies symmetrically (`'' == 0` is also false) and only
 * to the empty-string ↔ zero pair — every other `==` pair keeps standard
 * JS behaviour (so `'5' == 5` is still true).
 */
export function coerceEquality(op: EqOp, left: unknown, right: unknown): boolean {
  if (op === '===') return left === right;
  if (op === '!==') return left !== right;

  // SabFlow override: 0 == '' is false (matches n8n TES).
  const zeroEmpty =
    (left === 0 && right === '') || (left === '' && right === 0);
  // eslint-disable-next-line eqeqeq
  const eq = zeroEmpty ? false : left == right;
  return op === '==' ? eq : !eq;
}

// ---------------------------------------------------------------------------
// Inline dev tests — call __coerceDevTest() from a REPL or one-off script.
// Mirrors `src/lib/sabflow/expressions/__tests__.ts` (no test-runner hook).
// ---------------------------------------------------------------------------

type DevCase = { name: string; run: () => boolean };

const DEV_CASES: DevCase[] = [
  // --- to-string ---
  { name: 'string: null → ""', run: () => coerce(null, 'string') === '' },
  { name: 'string: undefined → ""', run: () => coerce(undefined, 'string') === '' },
  { name: 'string: object → JSON', run: () => coerce({ a: 1 }, 'string') === '{"a":1}' },
  { name: 'string: array → JSON', run: () => coerce([1, 2], 'string') === '[1,2]' },
  { name: 'string: number → "12.5"', run: () => coerce(12.5, 'string') === '12.5' },
  { name: 'string: boolean → "true"', run: () => coerce(true, 'string') === 'true' },

  // --- to-number ---
  { name: 'number: "" → 0', run: () => coerce('', 'number') === 0 },
  { name: 'number: null → 0', run: () => coerce(null, 'number') === 0 },
  { name: 'number: undefined → NaN', run: () => Number.isNaN(coerce(undefined, 'number')) },
  { name: 'number: "12.5" → 12.5', run: () => coerce('12.5', 'number') === 12.5 },
  { name: 'number: "12abc" → NaN', run: () => Number.isNaN(coerce('12abc', 'number')) },
  { name: 'number: true → 1', run: () => coerce(true, 'number') === 1 },
  { name: 'number: false → 0', run: () => coerce(false, 'number') === 0 },

  // --- to-boolean ---
  { name: 'boolean: 0 → false', run: () => coerce(0, 'boolean') === false },
  { name: 'boolean: "" → false', run: () => coerce('', 'boolean') === false },
  { name: 'boolean: NaN → false', run: () => coerce(Number.NaN, 'boolean') === false },
  { name: 'boolean: "x" → true', run: () => coerce('x', 'boolean') === true },
  { name: 'boolean: {} → true', run: () => coerce({}, 'boolean') === true },

  // --- to-array ---
  { name: 'array: [1] → [1]', run: () => JSON.stringify(coerce([1], 'array')) === '[1]' },
  { name: 'array: "a" → ["a"]', run: () => JSON.stringify(coerce('a', 'array')) === '["a"]' },
  { name: 'array: null → [null]', run: () => {
    const r = coerce(null, 'array');
    return r.length === 1 && r[0] === null;
  } },

  // --- to-object ---
  { name: 'object: {a:1} passes through', run: () => (coerce({ a: 1 }, 'object') as { a: number }).a === 1 },
  { name: 'object: "x" throws CoerceError', run: () => {
    try { coerce('x', 'object'); return false; } catch (e) { return e instanceof CoerceError; }
  } },

  // --- to-date ---
  { name: 'date: number → Date', run: () => coerce(0, 'date').toISOString() === '1970-01-01T00:00:00.000Z' },
  { name: 'date: ISO string → Date', run: () => coerce('2026-05-18T00:00:00Z', 'date').getUTCFullYear() === 2026 },
  { name: 'date: "not-a-date" throws', run: () => {
    try { coerce('not-a-date', 'date'); return false; } catch (e) { return e instanceof CoerceError; }
  } },

  // --- binary op ---
  { name: 'binary: "a" + 1 → "a1"', run: () => coerceBinary('+', 'a', 1) === 'a1' },
  { name: 'binary: 2 + 3 → 5', run: () => coerceBinary('+', 2, 3) === 5 },
  { name: 'binary: "10" - 3 → 7', run: () => coerceBinary('-', '10', 3) === 7 },
  { name: 'binary: "4" * "2" → 8', run: () => coerceBinary('*', '4', '2') === 8 },
  { name: 'binary: 10 / "2" → 5', run: () => coerceBinary('/', 10, '2') === 5 },

  // --- equality ---
  { name: 'eq: 1 === "1" → false (strict)', run: () => coerceEquality('===', 1, '1') === false },
  { name: 'eq: "5" == 5 → true (JS abstract)', run: () => coerceEquality('==', '5', 5) === true },
  { name: 'eq: 0 == "" → false (SabFlow override)', run: () => coerceEquality('==', 0, '') === false },
  { name: 'eq: "" == 0 → false (symmetric override)', run: () => coerceEquality('==', '', 0) === false },
  { name: 'eq: null == undefined → true', run: () => coerceEquality('==', null, undefined) === true },
  { name: 'eq: 1 !== 1 → false', run: () => coerceEquality('!==', 1, 1) === false },
];

/**
 * Run every coerce dev-test and log results.  Returns the pass-count so
 * callers can assert in CI if this is later wired into a runner.
 */
export function __coerceDevTest(): { passed: number; total: number; failures: string[] } {
  const failures: string[] = [];
  let passed = 0;
  for (const c of DEV_CASES) {
    let ok = false;
    try {
      ok = c.run();
    } catch (err) {
      ok = false;
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${c.name}: threw — ${msg}`);
      continue;
    }
    if (ok) passed++;
    else failures.push(c.name);
  }
  // eslint-disable-next-line no-console
  console.log(`[sabflow/executor/expression/coerce] ${passed}/${DEV_CASES.length} passed`);
  if (failures.length > 0) {
    // eslint-disable-next-line no-console
    console.log('failures:', failures);
  }
  return { passed, total: DEV_CASES.length, failures };
}
