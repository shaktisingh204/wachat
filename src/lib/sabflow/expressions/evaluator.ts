/**
 * Evaluator for SabFlow expression ASTs.
 *
 * Security model:
 *   - Property access is restricted — `__proto__`, `prototype`, and `constructor`
 *     are never reachable from the expression language.
 *   - The evaluator never calls `eval`, `Function`, or reflective APIs.
 *   - Every error is caught at the top-level `evaluate` call and converted
 *     into an `ExpressionResult.error`; expressions never throw out.
 *
 * Method-style calls on strings / arrays are implemented internally —
 * we do NOT dispatch to `Function.prototype.call` on user data, so there's no
 * way to smuggle in code execution via a malicious object.
 */

import type { ASTNode } from './parser';
import type { ExpressionContext } from './types';

const BANNED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/** Safe property read — returns `undefined` for banned / missing keys. */
function readProp(target: unknown, key: string | number): unknown {
  if (target === null || target === undefined) return undefined;
  const k = String(key);
  if (BANNED_KEYS.has(k)) return undefined;
  if (typeof target === 'string') {
    if (k === 'length') return target.length;
    const idx = Number(k);
    if (Number.isInteger(idx)) return target[idx];
    return undefined;
  }
  if (Array.isArray(target)) {
    if (k === 'length') return target.length;
    const idx = Number(k);
    if (Number.isInteger(idx)) return target[idx];
    // Allow reading named array props only if they're own enumerable
    if (Object.prototype.hasOwnProperty.call(target, k)) {
      return (target as unknown as Record<string, unknown>)[k];
    }
    return undefined;
  }
  if (typeof target === 'object') {
    if (Object.prototype.hasOwnProperty.call(target, k)) {
      return (target as Record<string, unknown>)[k];
    }
    return undefined;
  }
  if (target instanceof Date) {
    if (k === 'getTime') return target.getTime();
    return undefined;
  }
  return undefined;
}

/** Stringify an unknown value for template interpolation. */
export function coerceToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// ── Built-in methods on strings ─────────────────────────────────────────────

const STRING_METHODS = {
  trim: (s: string): string => s.trim(),
  toUpperCase: (s: string): string => s.toUpperCase(),
  toLowerCase: (s: string): string => s.toLowerCase(),
  toString: (s: string): string => s,
  toNumber: (s: string): number => Number(s),
  split: (s: string, sep: unknown): string[] => s.split(String(sep ?? '')),
  includes: (s: string, needle: unknown): boolean => s.includes(String(needle ?? '')),
  startsWith: (s: string, needle: unknown): boolean => s.startsWith(String(needle ?? '')),
  endsWith: (s: string, needle: unknown): boolean => s.endsWith(String(needle ?? '')),
  replace: (s: string, a: unknown, b: unknown): string =>
    s.split(String(a ?? '')).join(String(b ?? '')),
  slice: (s: string, start: unknown, end?: unknown): string => {
    const a = start === undefined ? 0 : Number(start);
    if (end === undefined) return s.slice(a);
    return s.slice(a, Number(end));
  },
  first: (s: string): string => s.charAt(0),
  last: (s: string): string => s.charAt(s.length - 1),
};

// ── Built-in methods on arrays ──────────────────────────────────────────────

const ARRAY_METHODS = {
  join: (arr: unknown[], sep: unknown): string =>
    arr.map((x) => coerceToString(x)).join(String(sep ?? ',')),
  includes: (arr: unknown[], needle: unknown): boolean => arr.includes(needle),
  slice: (arr: unknown[], start: unknown, end?: unknown): unknown[] => {
    const a = start === undefined ? 0 : Number(start);
    if (end === undefined) return arr.slice(a);
    return arr.slice(a, Number(end));
  },
  first: (arr: unknown[]): unknown => arr[0],
  last: (arr: unknown[]): unknown => arr[arr.length - 1],
  toString: (arr: unknown[]): string => arr.map((x) => coerceToString(x)).join(','),
  // `map` / `filter` accept an AST lambda — but since we have no function-literal
  // syntax, we fall back to identity / truthy semantics when the caller passes
  // a string (treated as a property-accessor path on each element).
  map: (arr: unknown[], fn: unknown): unknown[] => {
    if (typeof fn === 'string') return arr.map((el) => readProp(el, fn));
    return arr.slice();
  },
  filter: (arr: unknown[], fn: unknown): unknown[] => {
    if (typeof fn === 'string') return arr.filter((el) => Boolean(readProp(el, fn)));
    return arr.filter((x) => Boolean(x));
  },
};

// ── Top-level builtin functions ─────────────────────────────────────────────

type BuiltinFn = (args: unknown[]) => unknown;

const BUILTINS: Record<string, BuiltinFn> = {
  String: (args) => coerceToString(args[0]),
  Number: (args) => Number(args[0] as string | number),
  Boolean: (args) => Boolean(args[0]),
  // JSON.stringify / JSON.parse are exposed via the `JSON` identifier below.
};

// ── Format helpers (for $now.format(...)) ───────────────────────────────────

const PAD2 = (n: number): string => String(n).padStart(2, '0');

function formatDate(d: Date, fmt: string): string {
  // Minimal token set: YYYY, MM, DD, HH, mm, ss
  return fmt
    .replace(/YYYY/g, String(d.getFullYear()))
    .replace(/MM/g, PAD2(d.getMonth() + 1))
    .replace(/DD/g, PAD2(d.getDate()))
    .replace(/HH/g, PAD2(d.getHours()))
    .replace(/mm/g, PAD2(d.getMinutes()))
    .replace(/ss/g, PAD2(d.getSeconds()));
}

// ── Node evaluator ──────────────────────────────────────────────────────────

/**
 * A small abstraction for method calls: when the parser sees `foo.bar(args)`,
 * the evaluator needs to know the receiver (`foo`) to decide which built-in
 * table to consult.  Rather than materialising bound functions, we evaluate
 * `MemberAccess` + `CallExpression` together via a flag on the returned value.
 *
 * `PendingCallable` represents a not-yet-invoked method, captured before we
 * know whether the caller will invoke it (`.length` vs `.toUpperCase()`).
 */
type PendingCallable = {
  __pending: true;
  receiver: unknown;
  method: string;
};

function isPendingCallable(v: unknown): v is PendingCallable {
  return typeof v === 'object' && v !== null && (v as { __pending?: unknown }).__pending === true;
}

/** Resolve a member access — returns the property, or a PendingCallable if the
 * accessed slot is a built-in method that'd be legal to call on the receiver. */
function accessMember(receiver: unknown, name: string, ctx: ExpressionContext): unknown {
  if (BANNED_KEYS.has(name)) return undefined;

  // Strings & arrays may have built-in method access.
  if (typeof receiver === 'string') {
    if (name === 'length') return receiver.length;
    if (name in STRING_METHODS) {
      return { __pending: true, receiver, method: name } as PendingCallable;
    }
    // Fall through to numeric-index access
    const idx = Number(name);
    if (Number.isInteger(idx)) return receiver[idx];
    return undefined;
  }
  if (Array.isArray(receiver)) {
    if (name === 'length') return receiver.length;
    if (name in ARRAY_METHODS) {
      return { __pending: true, receiver, method: name } as PendingCallable;
    }
    const idx = Number(name);
    if (Number.isInteger(idx)) return receiver[idx];
    if (Object.prototype.hasOwnProperty.call(receiver, name)) {
      return (receiver as unknown as Record<string, unknown>)[name];
    }
    return undefined;
  }
  if (receiver instanceof Date) {
    if (name === 'format') return { __pending: true, receiver, method: 'format' } as PendingCallable;
    if (name === 'toISOString') return receiver.toISOString();
    if (name === 'getTime') return receiver.getTime();
    return undefined;
  }
  // Special JSON object
  if (receiver === JSON_HANDLE) {
    if (name === 'stringify') return { __pending: true, receiver: JSON_HANDLE, method: 'stringify' } as PendingCallable;
    if (name === 'parse') return { __pending: true, receiver: JSON_HANDLE, method: 'parse' } as PendingCallable;
    return undefined;
  }
  // Special Math object
  if (receiver === MATH_HANDLE) {
    if (name === 'floor' || name === 'ceil' || name === 'round' || name === 'abs' ||
        name === 'min' || name === 'max' || name === 'random') {
      return { __pending: true, receiver: MATH_HANDLE, method: name } as PendingCallable;
    }
    if (name === 'PI') return Math.PI;
    return undefined;
  }
  // $now specially — when the `MemberAccess` is on the context's now date, allow format
  return readProp(receiver, name);
}

// Sentinel objects representing the JSON / Math namespaces inside the DSL.
const JSON_HANDLE: unique symbol = Symbol('JSON');
const MATH_HANDLE: unique symbol = Symbol('Math');
type NamespaceHandle = typeof JSON_HANDLE | typeof MATH_HANDLE;

function invokeMethod(receiver: unknown, method: string, args: unknown[]): unknown {
  if (typeof receiver === 'string') {
    const fn = (STRING_METHODS as Record<string, (...a: unknown[]) => unknown>)[method];
    if (!fn) throw new Error(`unknown string method '${method}'`);
    return fn(receiver, ...args);
  }
  if (Array.isArray(receiver)) {
    const fn = (ARRAY_METHODS as Record<string, (...a: unknown[]) => unknown>)[method];
    if (!fn) throw new Error(`unknown array method '${method}'`);
    return fn(receiver, ...args);
  }
  if (receiver instanceof Date && method === 'format') {
    return formatDate(receiver, String(args[0] ?? 'YYYY-MM-DD'));
  }
  if (receiver === JSON_HANDLE) {
    if (method === 'stringify') {
      try { return JSON.stringify(args[0]); } catch { return undefined; }
    }
    if (method === 'parse') {
      try { return JSON.parse(String(args[0])); } catch { return undefined; }
    }
  }
  if (receiver === MATH_HANDLE) {
    switch (method) {
      case 'floor': return Math.floor(Number(args[0]));
      case 'ceil':  return Math.ceil(Number(args[0]));
      case 'round': return Math.round(Number(args[0]));
      case 'abs':   return Math.abs(Number(args[0]));
      case 'min':   return Math.min(...args.map((n) => Number(n)));
      case 'max':   return Math.max(...args.map((n) => Number(n)));
      case 'random': return Math.random();
      default:      throw new Error(`unknown Math method '${method}'`);
    }
  }
  throw new Error(`cannot invoke '${method}' on receiver`);
}

/** Resolve a top-level identifier (e.g. `$json`, `$now`, bare variable names). */
function resolveIdentifier(name: string, ctx: ExpressionContext): unknown {
  switch (name) {
    case '$json':      return ctx.json;
    case '$input':     return ctx.input;
    case '$node':      return ctx.node;
    case '$vars':      return ctx.vars;
    case '$env':       return ctx.env ?? {};
    case '$now':       return ctx.now;
    case '$workflow':  return ctx.workflow;
    case '$execution': return ctx.execution;
    case 'JSON':       return JSON_HANDLE;
    case 'Math':       return MATH_HANDLE;
    case 'true':       return true;
    case 'false':      return false;
    case 'null':       return null;
    case 'undefined':  return undefined;
    default: {
      // Bare identifier — Typebot back-compat: check vars first.
      if (ctx.vars && Object.prototype.hasOwnProperty.call(ctx.vars, name)) {
        return ctx.vars[name];
      }
      return undefined;
    }
  }
}

function strictEqual(a: unknown, b: unknown): boolean {
  return a === b;
}

function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (typeof a === 'number' && typeof b === 'string') return a === Number(b);
  if (typeof a === 'string' && typeof b === 'number') return Number(a) === b;
  if (typeof a === 'boolean') return looseEqual(a ? 1 : 0, b);
  if (typeof b === 'boolean') return looseEqual(a, b ? 1 : 0);
  return false;
}

function evalNode(node: ASTNode, ctx: ExpressionContext): unknown {
  switch (node.kind) {
    case 'Literal':
      return node.value;

    case 'Identifier':
      return resolveIdentifier(node.name, ctx);

    case 'MemberAccess': {
      const obj = evalNode(node.object, ctx);
      // Unwrap pending-callable accidentally passed through (.foo.bar chain)
      if (isPendingCallable(obj)) {
        // Invoking a method via .something is not valid — treat as undefined
        return undefined;
      }
      return accessMember(obj, node.property, ctx);
    }

    case 'IndexAccess': {
      const obj = evalNode(node.object, ctx);
      const idx = evalNode(node.index, ctx);
      if (isPendingCallable(obj)) return undefined;
      if (typeof idx !== 'string' && typeof idx !== 'number') return undefined;
      return accessMember(obj, String(idx), ctx);
    }

    case 'CallExpression': {
      const args = node.args.map((a) => evalNode(a, ctx));
      // Three kinds of call sites:
      //   1. callee is an Identifier → top-level builtin (String, Number, ...)
      //   2. callee is a MemberAccess / IndexAccess → method on a receiver
      //   3. anything else → error
      if (node.callee.kind === 'Identifier') {
        const fn = BUILTINS[node.callee.name];
        if (fn) return fn(args);
        // Unknown top-level call
        throw new Error(`unknown function '${node.callee.name}'`);
      }
      if (node.callee.kind === 'MemberAccess') {
        const receiver = evalNode(node.callee.object, ctx);
        return invokeMethod(receiver, node.callee.property, args);
      }
      if (node.callee.kind === 'IndexAccess') {
        const receiver = evalNode(node.callee.object, ctx);
        const methodName = evalNode(node.callee.index, ctx);
        return invokeMethod(receiver, String(methodName), args);
      }
      throw new Error('invalid call expression');
    }

    case 'BinaryOp': {
      const { op } = node;
      // Short-circuiting operators
      if (op === '&&') {
        const l = evalNode(node.left, ctx);
        return l ? evalNode(node.right, ctx) : l;
      }
      if (op === '||') {
        const l = evalNode(node.left, ctx);
        return l ? l : evalNode(node.right, ctx);
      }
      const l = evalNode(node.left, ctx);
      const r = evalNode(node.right, ctx);
      switch (op) {
        case '+': {
          if (typeof l === 'string' || typeof r === 'string') {
            return coerceToString(l) + coerceToString(r);
          }
          return (Number(l) + Number(r));
        }
        case '-':   return Number(l) - Number(r);
        case '*':   return Number(l) * Number(r);
        case '/':   return Number(l) / Number(r);
        case '%':   return Number(l) % Number(r);
        case '==':  return looseEqual(l, r);
        case '!=':  return !looseEqual(l, r);
        case '===': return strictEqual(l, r);
        case '!==': return !strictEqual(l, r);
        case '<':   return (l as number) < (r as number);
        case '>':   return (l as number) > (r as number);
        case '<=':  return (l as number) <= (r as number);
        case '>=':  return (l as number) >= (r as number);
        default: {
          const _exhaustive: never = op;
          throw new Error(`unhandled binary op: ${String(_exhaustive)}`);
        }
      }
    }

    case 'UnaryOp': {
      const v = evalNode(node.argument, ctx);
      if (node.op === '!') return !v;
      return -Number(v);
    }

    case 'Conditional': {
      const test = evalNode(node.test, ctx);
      return test ? evalNode(node.consequent, ctx) : evalNode(node.alternate, ctx);
    }

    default: {
      const _exhaustive: never = node;
      throw new Error(`unhandled node kind: ${String(_exhaustive)}`);
    }
  }
}

/** Public entry point — never throws.  Unwraps pending-callables at the end. */
export function evaluate(node: ASTNode, ctx: ExpressionContext): { value: unknown; error?: string } {
  try {
    const result = evalNode(node, ctx);
    if (isPendingCallable(result)) {
      // A pending method reference was the final result.  Typical cause:
      // author wrote `$json.foo.trim` (forgot the parens).  Evaluate as the
      // property name to stay forgiving rather than surfacing an obscure error.
      return { value: undefined };
    }
    return { value: result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { value: undefined, error: msg };
  }
}

// Export the namespace sentinel types for external callers (e.g. tests)
export const __internals = {
  JSON_HANDLE,
  MATH_HANDLE,
  coerceToString,
};
export type { NamespaceHandle };
