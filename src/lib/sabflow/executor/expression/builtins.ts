/**
 * SabFlow Executor — Expression Built-ins & Safe API Surface
 * ----------------------------------------------------------
 * Curated, dependency-free helpers exposed to user expressions executed by
 * the Track B SabFlow executor. Everything here is pure: no I/O, no globals,
 * no module-level mutable state. The shape is intentionally narrow — only
 * the surface enumerated by the Phase 4 spec is reachable from expression
 * code; arbitrary host primitives (`process`, `fetch`, `globalThis`, etc.)
 * MUST NOT leak through.
 *
 * Caller integration:
 *   const scope = buildBuiltinScope({ workflowId, executionId, mode });
 *   const value = evalExpression(ast, { ...userScope, ...scope });
 *
 * Resource caps:
 *   - JSON.parse rejects input strings larger than `JSON_PARSE_MAX_BYTES`
 *     (1 MiB by `Buffer.byteLength` / utf-8 length).
 *   - JSON.stringify caps its serialized output at `JSON_STRINGIFY_MAX_BYTES`
 *     (256 KiB).
 *   - Object literals materialised through `Object.fromEntries` and the
 *     array/object-rebuilding helpers are validated against
 *     `OBJECT_MAX_BYTES` (1 MiB UTF-8) and `OBJECT_MAX_DEPTH` (64).
 *
 * Errors thrown here are plain `Error` instances with a `code` tag so the
 * executor sandbox can map them to user-visible diagnostics (e.g.
 * `ExpressionRuntimeError`). Nothing is rethrown silently.
 */

// ─── Resource caps ──────────────────────────────────────────────────────────

/** 1 MiB — hard cap on `JSON.parse` input length (UTF-8 bytes). */
export const JSON_PARSE_MAX_BYTES = 1 * 1024 * 1024;
/** 256 KiB — hard cap on `JSON.stringify` output length (UTF-8 bytes). */
export const JSON_STRINGIFY_MAX_BYTES = 256 * 1024;
/** 1 MiB — hard cap on materialised object literal size (UTF-8 bytes). */
export const OBJECT_MAX_BYTES = 1 * 1024 * 1024;
/** Maximum nesting depth permitted for objects/arrays produced by builtins. */
export const OBJECT_MAX_DEPTH = 64;

// ─── Error helper ───────────────────────────────────────────────────────────

class BuiltinError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'BuiltinError';
    this.code = code;
  }
}

const fail = (code: string, message: string): never => {
  throw new BuiltinError(code, message);
};

// ─── UTF-8 byte length (no Buffer dep — works in Edge runtimes too) ─────────

const TEXT_ENCODER: TextEncoder | null =
  typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

function utf8ByteLength(s: string): number {
  if (TEXT_ENCODER) return TEXT_ENCODER.encode(s).length;
  // Fallback — manual UTF-8 byte counting for environments without TextEncoder.
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4;
      i++; // skip low surrogate
    } else bytes += 3;
  }
  return bytes;
}

// ─── Math (whitelisted) ─────────────────────────────────────────────────────

/**
 * A frozen subset of the global `Math` object. Only deterministic / numeric
 * primitives that are safe to expose are forwarded. `Math.random` is included
 * deliberately — expressions may need non-determinism (e.g. picking a random
 * branch in a flow) but the consumer is responsible for seeding policy.
 */
export const SafeMath = Object.freeze({
  abs: Math.abs,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  max: Math.max,
  min: Math.min,
  pow: Math.pow,
  sqrt: Math.sqrt,
  log: Math.log,
  exp: Math.exp,
  random: Math.random,
  sign: Math.sign,
  trunc: Math.trunc,
  PI: Math.PI,
  E: Math.E,
}) satisfies Readonly<Record<string, ((...a: number[]) => number) | number>>;

// ─── JSON (length-capped) ───────────────────────────────────────────────────

export const SafeJSON = Object.freeze({
  /**
   * Parse a JSON string. Rejects inputs whose UTF-8 byte length exceeds
   * {@link JSON_PARSE_MAX_BYTES}. The resulting value is validated against
   * the depth/size caps so a parsed structure cannot bypass the limits
   * enforced on literal construction.
   */
  parse(input: unknown): unknown {
    if (typeof input !== 'string') {
      return fail('E_JSON_PARSE_TYPE', 'JSON.parse expects a string');
    }
    if (utf8ByteLength(input) > JSON_PARSE_MAX_BYTES) {
      return fail(
        'E_JSON_PARSE_TOO_LARGE',
        `JSON.parse input exceeds ${JSON_PARSE_MAX_BYTES} bytes`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(input);
    } catch (e) {
      return fail(
        'E_JSON_PARSE_SYNTAX',
        `JSON.parse failed: ${(e as Error).message}`,
      );
    }
    enforceShape(parsed);
    return parsed;
  },

  /**
   * Stringify a value. Caps serialized output at
   * {@link JSON_STRINGIFY_MAX_BYTES}. Uses a circular-safe replacer so cycles
   * surface a clean error instead of a native `TypeError`.
   */
  stringify(value: unknown, space?: number | string): string {
    const seen = new WeakSet<object>();
    let out: string;
    try {
      out = JSON.stringify(
        value,
        (_key, v) => {
          if (typeof v === 'object' && v !== null) {
            if (seen.has(v as object)) {
              fail('E_JSON_STRINGIFY_CYCLE', 'JSON.stringify hit a cycle');
            }
            seen.add(v as object);
          }
          return v;
        },
        typeof space === 'number' || typeof space === 'string' ? space : undefined,
      );
    } catch (e) {
      if (e instanceof BuiltinError) throw e;
      return fail(
        'E_JSON_STRINGIFY_FAIL',
        `JSON.stringify failed: ${(e as Error).message}`,
      );
    }
    if (out === undefined) {
      return fail(
        'E_JSON_STRINGIFY_UNDEFINED',
        'JSON.stringify produced no output (top-level undefined / function / symbol)',
      );
    }
    if (utf8ByteLength(out) > JSON_STRINGIFY_MAX_BYTES) {
      return fail(
        'E_JSON_STRINGIFY_TOO_LARGE',
        `JSON.stringify output exceeds ${JSON_STRINGIFY_MAX_BYTES} bytes`,
      );
    }
    return out;
  },
});

// ─── Coercion constructors (callable-only, never `new`-able) ────────────────

/**
 * `String(x)` — coerces to string. Calling with `new` is rejected so the
 * sandbox cannot construct primitive wrapper objects.
 */
export function SafeString(x: unknown): string {
  if (new.target) fail('E_NEW_DISALLOWED', 'String cannot be used as a constructor');
  return String(x);
}
/** `Number(x)` — coerces to number. `new`-form construction is rejected. */
export function SafeNumber(x: unknown): number {
  if (new.target) fail('E_NEW_DISALLOWED', 'Number cannot be used as a constructor');
  return Number(x);
}
/** `Boolean(x)` — coerces to boolean. `new`-form construction is rejected. */
export function SafeBoolean(x: unknown): boolean {
  if (new.target) fail('E_NEW_DISALLOWED', 'Boolean cannot be used as a constructor');
  return Boolean(x);
}
/**
 * `Array(...)` — coerces to a plain array.
 *   - 0 args: empty array
 *   - 1 number arg: array of that length (capped at 100_000 to bound memory)
 *   - 1 iterable / array-like arg: shallow copy via `Array.from`
 *   - N args: returns `[...args]`
 *
 * `new Array(...)` is rejected to keep host primitive constructors out of the
 * sandbox surface.
 */
export function SafeArray<T = unknown>(...args: unknown[]): T[] {
  if (new.target) fail('E_NEW_DISALLOWED', 'Array cannot be used as a constructor');
  if (args.length === 0) return [];
  if (args.length === 1) {
    const a = args[0];
    if (typeof a === 'number') {
      if (!Number.isInteger(a) || a < 0 || a > 100_000) {
        return fail(
          'E_ARRAY_BAD_LENGTH',
          'Array(n) length must be a non-negative integer ≤ 100000',
        );
      }
      return new Array(a) as T[];
    }
    if (Array.isArray(a)) return a.slice() as T[];
    if (a && typeof (a as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function') {
      return Array.from(a as Iterable<T>);
    }
    return [a as T];
  }
  return args.slice() as T[];
}

// ─── Array helpers (safe whitelist) ─────────────────────────────────────────

function requireArray(a: unknown, name: string): unknown[] {
  if (!Array.isArray(a)) {
    return fail('E_ARRAY_EXPECTED', `${name} expects an array as first argument`);
  }
  return a;
}

export const ArrayHelpers = Object.freeze({
  map<T, U>(a: T[], fn: (v: T, i: number) => U): U[] {
    return requireArray(a, 'map').map((v, i) => fn(v as T, i));
  },
  filter<T>(a: T[], fn: (v: T, i: number) => unknown): T[] {
    return (requireArray(a, 'filter') as T[]).filter((v, i) => Boolean(fn(v, i)));
  },
  find<T>(a: T[], fn: (v: T, i: number) => unknown): T | undefined {
    return (requireArray(a, 'find') as T[]).find((v, i) => Boolean(fn(v, i)));
  },
  findIndex<T>(a: T[], fn: (v: T, i: number) => unknown): number {
    return (requireArray(a, 'findIndex') as T[]).findIndex((v, i) => Boolean(fn(v, i)));
  },
  slice<T>(a: T[], start?: number, end?: number): T[] {
    return (requireArray(a, 'slice') as T[]).slice(start, end);
  },
  concat<T>(a: T[], ...rest: (T | T[])[]): T[] {
    return (requireArray(a, 'concat') as T[]).concat(...rest);
  },
  join(a: unknown[], sep?: string): string {
    return requireArray(a, 'join').join(sep ?? ',');
  },
  includes<T>(a: T[], v: T): boolean {
    return (requireArray(a, 'includes') as T[]).includes(v);
  },
  indexOf<T>(a: T[], v: T): number {
    return (requireArray(a, 'indexOf') as T[]).indexOf(v);
  },
  length(a: unknown[]): number {
    return requireArray(a, 'length').length;
  },
  /** Returns a reversed copy — does NOT mutate the input. */
  reverse<T>(a: T[]): T[] {
    return (requireArray(a, 'reverse') as T[]).slice().reverse();
  },
  /** Returns a sorted copy — does NOT mutate the input. */
  sort<T>(a: T[], cmp?: (x: T, y: T) => number): T[] {
    return (requireArray(a, 'sort') as T[]).slice().sort(cmp);
  },
});

// ─── String helpers (safe whitelist) ────────────────────────────────────────

function requireString(s: unknown, name: string): string {
  if (typeof s !== 'string') {
    return fail('E_STRING_EXPECTED', `${name} expects a string as first argument`);
  }
  return s;
}

export const StringHelpers = Object.freeze({
  slice(s: string, start?: number, end?: number): string {
    return requireString(s, 'slice').slice(start, end);
  },
  substring(s: string, start: number, end?: number): string {
    return requireString(s, 'substring').substring(start, end);
  },
  replace(s: string, search: string | RegExp, replacement: string): string {
    return requireString(s, 'replace').replace(search, replacement);
  },
  replaceAll(s: string, search: string | RegExp, replacement: string): string {
    return requireString(s, 'replaceAll').replaceAll(search, replacement);
  },
  split(s: string, sep: string | RegExp, limit?: number): string[] {
    return requireString(s, 'split').split(sep, limit);
  },
  toLowerCase(s: string): string {
    return requireString(s, 'toLowerCase').toLowerCase();
  },
  toUpperCase(s: string): string {
    return requireString(s, 'toUpperCase').toUpperCase();
  },
  trim(s: string): string {
    return requireString(s, 'trim').trim();
  },
  trimStart(s: string): string {
    return requireString(s, 'trimStart').trimStart();
  },
  trimEnd(s: string): string {
    return requireString(s, 'trimEnd').trimEnd();
  },
  includes(s: string, search: string, position?: number): boolean {
    return requireString(s, 'includes').includes(search, position);
  },
  indexOf(s: string, search: string, fromIndex?: number): number {
    return requireString(s, 'indexOf').indexOf(search, fromIndex);
  },
  startsWith(s: string, search: string, position?: number): boolean {
    return requireString(s, 'startsWith').startsWith(search, position);
  },
  endsWith(s: string, search: string, endPosition?: number): boolean {
    return requireString(s, 'endsWith').endsWith(search, endPosition);
  },
  padStart(s: string, targetLength: number, padString?: string): string {
    if (!Number.isFinite(targetLength) || targetLength > 100_000) {
      return fail('E_PAD_LEN', 'padStart targetLength must be ≤ 100000');
    }
    return requireString(s, 'padStart').padStart(targetLength, padString);
  },
  padEnd(s: string, targetLength: number, padString?: string): string {
    if (!Number.isFinite(targetLength) || targetLength > 100_000) {
      return fail('E_PAD_LEN', 'padEnd targetLength must be ≤ 100000');
    }
    return requireString(s, 'padEnd').padEnd(targetLength, padString);
  },
  repeat(s: string, count: number): string {
    if (!Number.isInteger(count) || count < 0 || count > 100_000) {
      return fail('E_REPEAT_COUNT', 'repeat count must be a non-negative integer ≤ 100000');
    }
    const str = requireString(s, 'repeat');
    if (str.length * count > 1_000_000) {
      return fail('E_REPEAT_TOO_LARGE', 'repeat output exceeds 1,000,000 chars');
    }
    return str.repeat(count);
  },
  length(s: string): number {
    return requireString(s, 'length').length;
  },
});

// ─── Object helpers ─────────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === null || proto === Object.prototype;
}

export const ObjectHelpers = Object.freeze({
  keys(o: unknown): string[] {
    if (o === null || typeof o !== 'object') {
      return fail('E_OBJECT_EXPECTED', 'keys expects an object');
    }
    return Object.keys(o);
  },
  values(o: unknown): unknown[] {
    if (o === null || typeof o !== 'object') {
      return fail('E_OBJECT_EXPECTED', 'values expects an object');
    }
    return Object.values(o);
  },
  entries(o: unknown): [string, unknown][] {
    if (o === null || typeof o !== 'object') {
      return fail('E_OBJECT_EXPECTED', 'entries expects an object');
    }
    return Object.entries(o);
  },
  /**
   * Build a plain object from an iterable of `[key, value]` pairs. The result
   * is validated against {@link OBJECT_MAX_BYTES} and {@link OBJECT_MAX_DEPTH}
   * to prevent expression code from materialising pathologically large
   * structures.
   */
  fromEntries(entries: Iterable<readonly [string, unknown]>): Record<string, unknown> {
    if (!entries || typeof (entries as { [Symbol.iterator]?: unknown })[Symbol.iterator] !== 'function') {
      return fail('E_FROM_ENTRIES_ITER', 'fromEntries expects an iterable of [key, value] pairs');
    }
    const out: Record<string, unknown> = Object.create(null);
    for (const pair of entries) {
      if (!Array.isArray(pair) || pair.length < 2) {
        return fail('E_FROM_ENTRIES_PAIR', 'fromEntries entries must be [key, value] tuples');
      }
      const k = pair[0];
      if (typeof k !== 'string') {
        return fail('E_FROM_ENTRIES_KEY', 'fromEntries keys must be strings');
      }
      if (k === '__proto__' || k === 'prototype' || k === 'constructor') continue; // prototype pollution guard
      out[k] = pair[1];
    }
    enforceShape(out);
    return out;
  },
});

// ─── Shape / depth / size enforcement ───────────────────────────────────────

/**
 * Validate that `v` does not exceed {@link OBJECT_MAX_DEPTH} or
 * {@link OBJECT_MAX_BYTES}. Throws a {@link BuiltinError} when violated.
 * Cycles are detected and rejected explicitly.
 */
export function enforceShape(v: unknown): void {
  enforceDepth(v, 0, new WeakSet<object>());
  const approxBytes = estimateBytes(v);
  if (approxBytes > OBJECT_MAX_BYTES) {
    fail(
      'E_OBJECT_TOO_LARGE',
      `materialised value exceeds ${OBJECT_MAX_BYTES} bytes (≈${approxBytes})`,
    );
  }
}

function enforceDepth(v: unknown, depth: number, seen: WeakSet<object>): void {
  if (v === null || typeof v !== 'object') return;
  if (depth >= OBJECT_MAX_DEPTH) {
    fail('E_OBJECT_TOO_DEEP', `nested depth exceeds ${OBJECT_MAX_DEPTH}`);
  }
  if (seen.has(v as object)) {
    fail('E_OBJECT_CYCLE', 'cyclic object detected');
  }
  seen.add(v as object);
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) enforceDepth(v[i], depth + 1, seen);
  } else {
    for (const k of Object.keys(v as Record<string, unknown>)) {
      enforceDepth((v as Record<string, unknown>)[k], depth + 1, seen);
    }
  }
  seen.delete(v as object);
}

/** Rough UTF-8 byte estimate without serializing — bounded, non-throwing. */
function estimateBytes(v: unknown): number {
  if (v === null || v === undefined) return 4;
  switch (typeof v) {
    case 'boolean': return 5;
    case 'number': return 8;
    case 'string': return 2 + utf8ByteLength(v);
    case 'bigint': return v.toString().length;
    case 'object': {
      let n = 2; // braces / brackets
      if (Array.isArray(v)) {
        for (const x of v) n += 1 + estimateBytes(x);
      } else {
        for (const k of Object.keys(v as Record<string, unknown>)) {
          n += 3 + utf8ByteLength(k) + estimateBytes((v as Record<string, unknown>)[k]);
        }
      }
      return n;
    }
    default: return 0;
  }
}

// ─── DateTime ($now / $today) — dependency-free luxon-ish surface ───────────

/**
 * Units accepted by `plus`/`minus`. Mirrors the small luxon subset used by
 * Track A expressions so existing flows port without code changes.
 */
export type DateTimeDuration = Partial<{
  years: number;
  months: number;
  weeks: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
}>;

/**
 * Minimal luxon-compatible DateTime wrapper.
 *
 * `toFormat` supports a hand-picked set of tokens — yyyy, MM, dd, HH, hh,
 * mm, ss, SSS, a (AM/PM). It does NOT implement luxon's full grammar; the
 * spec calls for a useful subset, not parity.
 */
export class DateTime {
  private readonly _ts: number; // ms since epoch, UTC

  private constructor(ms: number) {
    this._ts = ms;
  }

  static fromMillis(ms: number): DateTime {
    if (typeof ms !== 'number' || !Number.isFinite(ms)) {
      return fail('E_DT_MS', 'DateTime.fromMillis requires a finite number');
    }
    return new DateTime(ms);
  }
  static fromDate(d: Date): DateTime {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
      return fail('E_DT_DATE', 'DateTime.fromDate requires a valid Date');
    }
    return new DateTime(d.getTime());
  }
  static now(): DateTime {
    return new DateTime(Date.now());
  }
  static today(): DateTime {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return new DateTime(d.getTime());
  }

  /** Year (UTC, 4-digit). */
  get year(): number { return new Date(this._ts).getUTCFullYear(); }
  /** Month, 1–12 (UTC). */
  get month(): number { return new Date(this._ts).getUTCMonth() + 1; }
  /** Day of month, 1–31 (UTC). */
  get day(): number { return new Date(this._ts).getUTCDate(); }
  /** Hour, 0–23 (UTC). */
  get hour(): number { return new Date(this._ts).getUTCHours(); }
  /** Minute, 0–59 (UTC). */
  get minute(): number { return new Date(this._ts).getUTCMinutes(); }
  /** Second, 0–59 (UTC). */
  get second(): number { return new Date(this._ts).getUTCSeconds(); }
  /** Millisecond, 0–999 (UTC). */
  get millisecond(): number { return new Date(this._ts).getUTCMilliseconds(); }
  /** Day of week, 1 (Monday) – 7 (Sunday) — matches luxon's `weekday`. */
  get weekday(): number {
    const w = new Date(this._ts).getUTCDay(); // 0=Sun..6=Sat
    return w === 0 ? 7 : w;
  }

  /** Add a duration (`{ days: 3, hours: -2 }`). Returns a new DateTime. */
  plus(d: DateTimeDuration): DateTime {
    return this._shift(d, 1);
  }
  /** Subtract a duration. Returns a new DateTime. */
  minus(d: DateTimeDuration): DateTime {
    return this._shift(d, -1);
  }

  private _shift(d: DateTimeDuration, sign: 1 | -1): DateTime {
    if (!d || typeof d !== 'object') {
      return fail('E_DT_DURATION', 'plus/minus expects a duration object');
    }
    const dt = new Date(this._ts);
    if (d.years)        dt.setUTCFullYear(dt.getUTCFullYear() + sign * d.years);
    if (d.months)       dt.setUTCMonth(dt.getUTCMonth() + sign * d.months);
    if (d.weeks)        dt.setUTCDate(dt.getUTCDate() + sign * d.weeks * 7);
    if (d.days)         dt.setUTCDate(dt.getUTCDate() + sign * d.days);
    if (d.hours)        dt.setUTCHours(dt.getUTCHours() + sign * d.hours);
    if (d.minutes)      dt.setUTCMinutes(dt.getUTCMinutes() + sign * d.minutes);
    if (d.seconds)      dt.setUTCSeconds(dt.getUTCSeconds() + sign * d.seconds);
    if (d.milliseconds) dt.setUTCMilliseconds(dt.getUTCMilliseconds() + sign * d.milliseconds);
    return new DateTime(dt.getTime());
  }

  /**
   * Format using the luxon-subset token grammar:
   *   yyyy  4-digit year         MM    2-digit month
   *   dd    2-digit day          HH    2-digit 24h hour
   *   hh    2-digit 12h hour     mm    2-digit minute
   *   ss    2-digit second       SSS   3-digit millisecond
   *   a     AM / PM
   * Any unknown character is passed through verbatim. Literal text can be
   * quoted with single quotes (`'yyyy'` → `yyyy`).
   */
  toFormat(fmt: string): string {
    if (typeof fmt !== 'string') {
      return fail('E_DT_FORMAT', 'toFormat requires a string');
    }
    const dt = new Date(this._ts);
    const y = dt.getUTCFullYear();
    const M = dt.getUTCMonth() + 1;
    const D = dt.getUTCDate();
    const H = dt.getUTCHours();
    const h12 = ((H + 11) % 12) + 1;
    const mi = dt.getUTCMinutes();
    const se = dt.getUTCSeconds();
    const ms = dt.getUTCMilliseconds();
    const ampm = H < 12 ? 'AM' : 'PM';
    const pad = (n: number, w: number) => String(n).padStart(w, '0');

    let out = '';
    let i = 0;
    while (i < fmt.length) {
      const ch = fmt[i];
      if (ch === "'") {
        // literal segment until next single-quote
        const end = fmt.indexOf("'", i + 1);
        if (end === -1) { out += fmt.slice(i + 1); break; }
        out += fmt.slice(i + 1, end);
        i = end + 1;
        continue;
      }
      // longest-match token attempts
      if (fmt.startsWith('yyyy', i)) { out += pad(y, 4); i += 4; continue; }
      if (fmt.startsWith('SSS', i))  { out += pad(ms, 3); i += 3; continue; }
      if (fmt.startsWith('MM', i))   { out += pad(M, 2);  i += 2; continue; }
      if (fmt.startsWith('dd', i))   { out += pad(D, 2);  i += 2; continue; }
      if (fmt.startsWith('HH', i))   { out += pad(H, 2);  i += 2; continue; }
      if (fmt.startsWith('hh', i))   { out += pad(h12, 2); i += 2; continue; }
      if (fmt.startsWith('mm', i))   { out += pad(mi, 2); i += 2; continue; }
      if (fmt.startsWith('ss', i))   { out += pad(se, 2); i += 2; continue; }
      if (ch === 'a')                { out += ampm;       i += 1; continue; }
      out += ch;
      i += 1;
    }
    return out;
  }

  /** ISO-8601 string in UTC (e.g. `2026-05-18T12:34:56.789Z`). */
  toISO(): string {
    return new Date(this._ts).toISOString();
  }
  /** Milliseconds since the Unix epoch. */
  toMillis(): number {
    return this._ts;
  }
  /** Native Date instance — convenience for interop. */
  toJSDate(): Date {
    return new Date(this._ts);
  }
  toString(): string {
    return this.toISO();
  }
  toJSON(): string {
    return this.toISO();
  }
}

// ─── EvalScope plumbing ($workflow, $execution) ─────────────────────────────

/**
 * Execution-mode tag mirrored from {@link ExpressionContext.execution.mode}.
 * Kept as a string literal union so this module does not import the legacy
 * `expressions/` types (avoids a circular dep with the Track A evaluator).
 */
export type ExecutionMode = 'manual' | 'trigger' | 'test' | 'webhook' | 'cron';

/**
 * The shape the executor passes into {@link buildBuiltinScope}. Mirrors the
 * relevant slice of the Track B `EvalScope`.
 */
export interface BuiltinScopeInput {
  workflow: { id: string; name?: string };
  execution: { id: string; mode: ExecutionMode };
}

/**
 * The frozen scope merged into expression evaluation. Each top-level entry
 * matches a `$`-prefixed identifier in user expressions.
 */
export interface BuiltinScope {
  readonly Math: typeof SafeMath;
  readonly JSON: typeof SafeJSON;
  readonly String: typeof SafeString;
  readonly Number: typeof SafeNumber;
  readonly Boolean: typeof SafeBoolean;
  readonly Array: typeof SafeArray;
  readonly Object: typeof ObjectHelpers;
  readonly $array: typeof ArrayHelpers;
  readonly $string: typeof StringHelpers;
  readonly $now: DateTime;
  readonly $today: DateTime;
  readonly $workflow: Readonly<{ id: string; name?: string }>;
  readonly $execution: Readonly<{ id: string; mode: ExecutionMode }>;
  readonly DateTime: typeof DateTime;
}

/**
 * Build a fresh, frozen built-in scope for one expression evaluation. `$now`
 * and `$today` are captured at call time so multiple references within a
 * single evaluation see a consistent clock.
 */
export function buildBuiltinScope(input: BuiltinScopeInput): BuiltinScope {
  if (!input || typeof input !== 'object') {
    fail('E_SCOPE_INPUT', 'buildBuiltinScope requires a scope input');
  }
  if (!input.workflow || typeof input.workflow.id !== 'string') {
    fail('E_SCOPE_WORKFLOW', 'buildBuiltinScope requires workflow.id');
  }
  if (!input.execution || typeof input.execution.id !== 'string') {
    fail('E_SCOPE_EXECUTION', 'buildBuiltinScope requires execution.id');
  }
  const scope: BuiltinScope = {
    Math: SafeMath,
    JSON: SafeJSON,
    String: SafeString,
    Number: SafeNumber,
    Boolean: SafeBoolean,
    Array: SafeArray,
    Object: ObjectHelpers,
    $array: ArrayHelpers,
    $string: StringHelpers,
    $now: DateTime.now(),
    $today: DateTime.today(),
    $workflow: Object.freeze({ id: input.workflow.id, name: input.workflow.name }),
    $execution: Object.freeze({ id: input.execution.id, mode: input.execution.mode }),
    DateTime,
  };
  return Object.freeze(scope);
}

// ─── Re-exports for the executor's sandbox bootstrap ────────────────────────

export { BuiltinError };
