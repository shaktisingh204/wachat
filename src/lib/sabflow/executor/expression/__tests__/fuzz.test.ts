/**
 * Fuzz tests for the SabFlow executor expression engine.
 *
 *   npx tsx --test src/lib/sabflow/executor/expression/__tests__/fuzz.test.ts
 *
 * What this proves:
 *   - 5000 PRNG-driven random expressions tokenize/parse/evaluate without
 *     crashing the host process.  Every failure surfaces as a typed
 *     ExpressionError | ParseError | TokenizeError — never a raw throw.
 *   - When a generated input is well-formed AND the engine supports
 *     AST-to-source printing, the round-trip (print → tokenize → parse)
 *     produces a structurally identical AST.
 *
 * Determinism: the PRNG seed is fixed by default.  On failure, the seed
 * and the offending source are printed so the run can be replayed:
 *
 *   SABFLOW_FUZZ_SEED=12345 npx tsx --test fuzz.test.ts
 *
 * Engine wiring: this file forward-declares the engine entrypoints inline
 * as a small reference implementation so the fuzz suite runs even before
 * the production tokenize.ts/parse.ts/evaluate.ts siblings merge.  The
 * implementation is faithful to the documented grammar (see corpus.json).
 * The reference engine is re-exported so `corpus.test.ts` can share it.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

/* ───────────────────────────────────────────────────────────────────────────
 * Forward-decl engine entrypoints (re-exported for corpus.test.ts).
 * Production code will replace this block with `import` from sibling files;
 * the public shape (class names, function signatures) is the contract.
 * ─────────────────────────────────────────────────────────────────────────── */

export class TokenizeError extends Error {
  public readonly pos: number;
  constructor(msg: string, pos: number) {
    super(`TokenizeError@${pos}: ${msg}`);
    this.name = 'TokenizeError';
    this.pos = pos;
  }
}
export class ParseError extends Error {
  public readonly pos: number;
  constructor(msg: string, pos: number) {
    super(`ParseError@${pos}: ${msg}`);
    this.name = 'ParseError';
    this.pos = pos;
  }
}
export class ExpressionError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ExpressionError';
  }
}

export type TokenType =
  | 'ident' | 'num' | 'str' | 'punct' | 'op' | 'cmp' | 'logical' | 'eof';
export type Token = { type: TokenType; value: string; pos: number };

export type AST =
  | { kind: 'Lit'; value: unknown }
  | { kind: 'Id'; name: string }
  | { kind: 'Member'; object: AST; property: string }
  | { kind: 'Index'; object: AST; index: AST }
  | { kind: 'Call'; callee: AST; args: AST[] }
  | { kind: 'Bin'; op: string; left: AST; right: AST }
  | { kind: 'Un'; op: '!' | '-'; arg: AST }
  | { kind: 'Cond'; test: AST; cons: AST; alt: AST };

export type Scope = {
  json?: unknown;
  input?: { item?: { json?: unknown }; all?: { json?: unknown }[] };
  node?: Record<string, { json?: unknown }>;
  vars?: Record<string, unknown>;
  env?: Record<string, string>;
  now?: Date | string;
  workflow?: { id: string; name: string };
  execution?: { id: string; mode: string };
};

/* ── Tokenizer ───────────────────────────────────────────────────────────── */

const isWs = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r';
const isDigit = (c: string) => c >= '0' && c <= '9';
const isIdStart = (c: string) =>
  (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$';
const isIdPart = (c: string) => isIdStart(c) || isDigit(c);

export function tokenize(src: string): Token[] {
  // Strip {{ }} wrapper if present.
  const trimmed = src.trim();
  const body =
    trimmed.startsWith('{{') && trimmed.endsWith('}}')
      ? trimmed.slice(2, -2)
      : trimmed;
  const out: Token[] = [];
  let i = 0;
  while (i < body.length) {
    const c = body[i];
    if (isWs(c)) { i++; continue; }
    if (isIdStart(c)) {
      const start = i;
      i++;
      while (i < body.length && isIdPart(body[i])) i++;
      out.push({ type: 'ident', value: body.slice(start, i), pos: start });
      continue;
    }
    if (isDigit(c)) {
      const start = i;
      let sawDot = false;
      while (i < body.length) {
        if (isDigit(body[i])) { i++; continue; }
        if (body[i] === '.' && !sawDot && isDigit(body[i + 1] ?? '')) {
          sawDot = true; i++; continue;
        }
        break;
      }
      out.push({ type: 'num', value: body.slice(start, i), pos: start });
      continue;
    }
    if (c === '"' || c === '\'' || c === '`') {
      const quote = c;
      const start = i;
      i++;
      let buf = '';
      let closed = false;
      while (i < body.length) {
        const ch = body[i];
        if (ch === '\\') {
          const nx = body[i + 1];
          if (nx === undefined) throw new TokenizeError('unterminated escape', i);
          const map: Record<string, string> = { n: '\n', t: '\t', r: '\r', '\\': '\\', '\'': '\'', '"': '"', '`': '`', '0': '\0' };
          buf += map[nx] ?? nx;
          i += 2;
          continue;
        }
        if (ch === quote) { i++; closed = true; break; }
        buf += ch;
        i++;
      }
      if (!closed) throw new TokenizeError('unterminated string', start);
      out.push({ type: 'str', value: buf, pos: start });
      continue;
    }
    if ('.,()[]?:'.includes(c)) {
      out.push({ type: 'punct', value: c, pos: i });
      i++;
      continue;
    }
    if (c === '+' || c === '-' || c === '*' || c === '/' || c === '%') {
      out.push({ type: 'op', value: c, pos: i });
      i++;
      continue;
    }
    if (c === '=' && body[i + 1] === '=') {
      const strict = body[i + 2] === '=';
      out.push({ type: 'cmp', value: strict ? '===' : '==', pos: i });
      i += strict ? 3 : 2;
      continue;
    }
    if (c === '!' && body[i + 1] === '=') {
      const strict = body[i + 2] === '=';
      out.push({ type: 'cmp', value: strict ? '!==' : '!=', pos: i });
      i += strict ? 3 : 2;
      continue;
    }
    if (c === '!') { out.push({ type: 'logical', value: '!', pos: i }); i++; continue; }
    if (c === '<' || c === '>') {
      const eq = body[i + 1] === '=';
      out.push({ type: 'cmp', value: eq ? `${c}=` : c, pos: i });
      i += eq ? 2 : 1;
      continue;
    }
    if (c === '&' && body[i + 1] === '&') { out.push({ type: 'logical', value: '&&', pos: i }); i += 2; continue; }
    if (c === '|' && body[i + 1] === '|') { out.push({ type: 'logical', value: '||', pos: i }); i += 2; continue; }
    throw new TokenizeError(`unexpected character '${c}'`, i);
  }
  out.push({ type: 'eof', value: '', pos: body.length });
  return out;
}

/* ── Parser ──────────────────────────────────────────────────────────────── */

export function parse(tokens: Token[]): AST {
  let i = 0;
  const peek = (off = 0): Token => tokens[i + off];
  const eat = (): Token => tokens[i++];
  const check = (type: TokenType, value?: string) => {
    const t = peek();
    if (!t || t.type !== type) return false;
    if (value !== undefined && t.value !== value) return false;
    return true;
  };
  const expect = (type: TokenType, value?: string): Token => {
    if (!check(type, value)) {
      const t = peek();
      throw new ParseError(
        `expected ${type}${value ? ` '${value}'` : ''}, got ${t ? `${t.type} '${t.value}'` : 'eof'}`,
        t?.pos ?? -1,
      );
    }
    return eat();
  };

  const parseExpr = (): AST => parseTernary();
  const parseTernary = (): AST => {
    const test = parseOr();
    if (check('punct', '?')) {
      eat();
      const cons = parseTernary();
      expect('punct', ':');
      const alt = parseTernary();
      return { kind: 'Cond', test, cons, alt };
    }
    return test;
  };
  const parseOr = (): AST => {
    let left = parseAnd();
    while (check('logical', '||')) { eat(); left = { kind: 'Bin', op: '||', left, right: parseAnd() }; }
    return left;
  };
  const parseAnd = (): AST => {
    let left = parseEq();
    while (check('logical', '&&')) { eat(); left = { kind: 'Bin', op: '&&', left, right: parseEq() }; }
    return left;
  };
  const parseEq = (): AST => {
    let left = parseCmp();
    while (check('cmp', '==') || check('cmp', '!=') || check('cmp', '===') || check('cmp', '!==')) {
      const op = eat().value;
      left = { kind: 'Bin', op, left, right: parseCmp() };
    }
    return left;
  };
  const parseCmp = (): AST => {
    let left = parseAdd();
    while (check('cmp', '<') || check('cmp', '>') || check('cmp', '<=') || check('cmp', '>=')) {
      const op = eat().value;
      left = { kind: 'Bin', op, left, right: parseAdd() };
    }
    return left;
  };
  const parseAdd = (): AST => {
    let left = parseMul();
    while (check('op', '+') || check('op', '-')) {
      const op = eat().value;
      left = { kind: 'Bin', op, left, right: parseMul() };
    }
    return left;
  };
  const parseMul = (): AST => {
    let left = parseUn();
    while (check('op', '*') || check('op', '/') || check('op', '%')) {
      const op = eat().value;
      left = { kind: 'Bin', op, left, right: parseUn() };
    }
    return left;
  };
  const parseUn = (): AST => {
    if (check('logical', '!')) { eat(); return { kind: 'Un', op: '!', arg: parseUn() }; }
    if (check('op', '-')) { eat(); return { kind: 'Un', op: '-', arg: parseUn() }; }
    return parseAccess();
  };
  const parseAccess = (): AST => {
    let node = parsePrimary();
    while (true) {
      if (check('punct', '.')) {
        eat();
        const name = expect('ident').value;
        node = { kind: 'Member', object: node, property: name };
        continue;
      }
      if (check('punct', '[')) {
        eat();
        const index = parseExpr();
        expect('punct', ']');
        node = { kind: 'Index', object: node, index };
        continue;
      }
      if (check('punct', '(')) {
        eat();
        const args: AST[] = [];
        if (!check('punct', ')')) {
          args.push(parseExpr());
          while (check('punct', ',')) { eat(); args.push(parseExpr()); }
        }
        expect('punct', ')');
        node = { kind: 'Call', callee: node, args };
        continue;
      }
      break;
    }
    return node;
  };
  const parsePrimary = (): AST => {
    const t = peek();
    if (!t) throw new ParseError('unexpected end of input', -1);
    if (t.type === 'num') { eat(); return { kind: 'Lit', value: Number(t.value) }; }
    if (t.type === 'str') { eat(); return { kind: 'Lit', value: t.value }; }
    if (t.type === 'ident') {
      eat();
      if (t.value === 'true') return { kind: 'Lit', value: true };
      if (t.value === 'false') return { kind: 'Lit', value: false };
      if (t.value === 'null') return { kind: 'Lit', value: null };
      if (t.value === 'undefined') return { kind: 'Lit', value: undefined };
      return { kind: 'Id', name: t.value };
    }
    if (t.type === 'punct' && t.value === '(') {
      eat();
      const inner = parseExpr();
      expect('punct', ')');
      return inner;
    }
    throw new ParseError(`unexpected token '${t.value}'`, t.pos);
  };

  const ast = parseExpr();
  if (!check('eof')) {
    const t = peek();
    throw new ParseError(`unexpected token '${t.value}'`, t.pos);
  }
  return ast;
}

/* ── Evaluator ───────────────────────────────────────────────────────────── */

const BANNED = new Set(['__proto__', 'prototype', 'constructor']);
const JSON_NS = Symbol('JSON');
const MATH_NS = Symbol('Math');

type Pending = { __pending: true; receiver: unknown; method: string };
const isPending = (v: unknown): v is Pending =>
  typeof v === 'object' && v !== null && (v as { __pending?: unknown }).__pending === true;

function readProp(target: unknown, key: string): unknown {
  if (target === null || target === undefined) return undefined;
  if (BANNED.has(key)) return undefined;
  if (typeof target === 'string') {
    if (key === 'length') return target.length;
    const idx = Number(key);
    if (Number.isInteger(idx)) return target[idx];
    return undefined;
  }
  if (Array.isArray(target)) {
    if (key === 'length') return target.length;
    const idx = Number(key);
    if (Number.isInteger(idx)) return target[idx];
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      return (target as unknown as Record<string, unknown>)[key];
    }
    return undefined;
  }
  if (target instanceof Date) {
    if (key === 'getTime') return target.getTime();
    return undefined;
  }
  if (typeof target === 'object') {
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      return (target as Record<string, unknown>)[key];
    }
    return undefined;
  }
  return undefined;
}

function coerceString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  try { return JSON.stringify(v); } catch { return String(v); }
}

function formatDate(d: Date, fmt: string): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return fmt
    .replace(/YYYY/g, String(d.getUTCFullYear()))
    .replace(/MM/g, pad(d.getUTCMonth() + 1))
    .replace(/DD/g, pad(d.getUTCDate()))
    .replace(/HH/g, pad(d.getUTCHours()))
    .replace(/mm/g, pad(d.getUTCMinutes()))
    .replace(/ss/g, pad(d.getUTCSeconds()));
}

const STR_METHODS: Record<string, (s: string, ...a: unknown[]) => unknown> = {
  trim: (s) => s.trim(),
  toUpperCase: (s) => s.toUpperCase(),
  toLowerCase: (s) => s.toLowerCase(),
  toString: (s: string) => s,
  toNumber: (s: string) => Number(s),
  split: (s, sep) => s.split(String(sep ?? '')),
  includes: (s, needle) => s.includes(String(needle ?? '')),
  startsWith: (s, needle) => s.startsWith(String(needle ?? '')),
  endsWith: (s, needle) => s.endsWith(String(needle ?? '')),
  replace: (s, a, b) => s.split(String(a ?? '')).join(String(b ?? '')),
  slice: (s, a, b) => (b === undefined ? s.slice(Number(a ?? 0)) : s.slice(Number(a ?? 0), Number(b))),
  first: (s) => s.charAt(0),
  last: (s) => s.charAt(s.length - 1),
};
const ARR_METHODS: Record<string, (a: unknown[], ...x: unknown[]) => unknown> = {
  join: (a, sep) => a.map(coerceString).join(String(sep ?? ',')),
  includes: (a, n) => a.includes(n),
  slice: (a, s, e) => (e === undefined ? a.slice(Number(s ?? 0)) : a.slice(Number(s ?? 0), Number(e))),
  first: (a) => a[0],
  last: (a) => a[a.length - 1],
  toString: (a: unknown[]) => a.map(coerceString).join(','),
};
const BUILTINS: Record<string, (a: unknown[]) => unknown> = {
  String: (a) => coerceString(a[0]),
  Number: (a) => Number(a[0] as number | string),
  Boolean: (a) => Boolean(a[0]),
};

function accessMember(recv: unknown, name: string): unknown {
  if (BANNED.has(name)) return undefined;
  if (typeof recv === 'string') {
    if (name === 'length') return recv.length;
    if (name in STR_METHODS) return { __pending: true, receiver: recv, method: name } as Pending;
    const idx = Number(name);
    if (Number.isInteger(idx)) return recv[idx];
    return undefined;
  }
  if (Array.isArray(recv)) {
    if (name === 'length') return recv.length;
    if (name in ARR_METHODS) return { __pending: true, receiver: recv, method: name } as Pending;
    const idx = Number(name);
    if (Number.isInteger(idx)) return recv[idx];
    return undefined;
  }
  if (recv instanceof Date) {
    if (name === 'format') return { __pending: true, receiver: recv, method: 'format' } as Pending;
    if (name === 'toISOString') return recv.toISOString();
    if (name === 'getTime') return recv.getTime();
    return undefined;
  }
  if (recv === JSON_NS) {
    if (name === 'stringify' || name === 'parse') {
      return { __pending: true, receiver: JSON_NS, method: name } as Pending;
    }
    return undefined;
  }
  if (recv === MATH_NS) {
    if (['floor', 'ceil', 'round', 'abs', 'min', 'max', 'random'].includes(name)) {
      return { __pending: true, receiver: MATH_NS, method: name } as Pending;
    }
    if (name === 'PI') return Math.PI;
    return undefined;
  }
  return readProp(recv, name);
}

function invokeMethod(recv: unknown, method: string, args: unknown[]): unknown {
  if (typeof recv === 'string') {
    const fn = STR_METHODS[method];
    if (!fn) throw new ExpressionError(`unknown string method '${method}'`);
    return fn(recv, ...args);
  }
  if (Array.isArray(recv)) {
    const fn = ARR_METHODS[method];
    if (!fn) throw new ExpressionError(`unknown array method '${method}'`);
    return fn(recv, ...args);
  }
  if (recv instanceof Date && method === 'format') {
    return formatDate(recv, String(args[0] ?? 'YYYY-MM-DD'));
  }
  if (recv === JSON_NS) {
    if (method === 'stringify') { try { return JSON.stringify(args[0]); } catch { return undefined; } }
    if (method === 'parse') { try { return JSON.parse(String(args[0])); } catch { return undefined; } }
  }
  if (recv === MATH_NS) {
    switch (method) {
      case 'floor': return Math.floor(Number(args[0]));
      case 'ceil':  return Math.ceil(Number(args[0]));
      case 'round': return Math.round(Number(args[0]));
      case 'abs':   return Math.abs(Number(args[0]));
      case 'min':   return Math.min(...args.map((n) => Number(n)));
      case 'max':   return Math.max(...args.map((n) => Number(n)));
      case 'random': return Math.random();
    }
  }
  throw new ExpressionError(`cannot invoke '${method}' on receiver`);
}

function resolveId(name: string, scope: Scope): unknown {
  switch (name) {
    case '$json':      return scope.json;
    case '$input':     return scope.input;
    case '$node':      return scope.node;
    case '$vars':      return scope.vars;
    case '$env':       return scope.env ?? {};
    case '$now':       return scope.now instanceof Date ? scope.now : (typeof scope.now === 'string' ? new Date(scope.now) : new Date(0));
    case '$workflow':  return scope.workflow;
    case '$execution': return scope.execution;
    case 'JSON':       return JSON_NS;
    case 'Math':       return MATH_NS;
    default: {
      if (scope.vars && Object.prototype.hasOwnProperty.call(scope.vars, name)) return scope.vars[name];
      return undefined;
    }
  }
}

function looseEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (typeof a === 'number' && typeof b === 'string') return a === Number(b);
  if (typeof a === 'string' && typeof b === 'number') return Number(a) === b;
  if (typeof a === 'boolean') return looseEq(a ? 1 : 0, b);
  if (typeof b === 'boolean') return looseEq(a, b ? 1 : 0);
  return false;
}

function evalNode(n: AST, s: Scope): unknown {
  switch (n.kind) {
    case 'Lit': return n.value;
    case 'Id':  return resolveId(n.name, s);
    case 'Member': {
      const o = evalNode(n.object, s);
      if (isPending(o)) return undefined;
      return accessMember(o, n.property);
    }
    case 'Index': {
      const o = evalNode(n.object, s);
      const idx = evalNode(n.index, s);
      if (isPending(o)) return undefined;
      if (typeof idx !== 'string' && typeof idx !== 'number') return undefined;
      return accessMember(o, String(idx));
    }
    case 'Call': {
      const args = n.args.map((a) => evalNode(a, s));
      if (n.callee.kind === 'Id') {
        const fn = BUILTINS[n.callee.name];
        if (fn) return fn(args);
        throw new ExpressionError(`unknown function '${n.callee.name}'`);
      }
      if (n.callee.kind === 'Member') {
        const recv = evalNode(n.callee.object, s);
        return invokeMethod(recv, n.callee.property, args);
      }
      if (n.callee.kind === 'Index') {
        const recv = evalNode(n.callee.object, s);
        const m = evalNode(n.callee.index, s);
        return invokeMethod(recv, String(m), args);
      }
      throw new ExpressionError('invalid call expression');
    }
    case 'Bin': {
      const { op } = n;
      if (op === '&&') { const l = evalNode(n.left, s); return l ? evalNode(n.right, s) : l; }
      if (op === '||') { const l = evalNode(n.left, s); return l ? l : evalNode(n.right, s); }
      const l = evalNode(n.left, s);
      const r = evalNode(n.right, s);
      switch (op) {
        case '+':
          if (typeof l === 'string' || typeof r === 'string') return coerceString(l) + coerceString(r);
          return Number(l) + Number(r);
        case '-':   return Number(l) - Number(r);
        case '*':   return Number(l) * Number(r);
        case '/':   return Number(l) / Number(r);
        case '%':   return Number(l) % Number(r);
        case '==':  return looseEq(l, r);
        case '!=':  return !looseEq(l, r);
        case '===': return l === r;
        case '!==': return l !== r;
        case '<':   return (l as number) <  (r as number);
        case '>':   return (l as number) >  (r as number);
        case '<=':  return (l as number) <= (r as number);
        case '>=':  return (l as number) >= (r as number);
        default: throw new ExpressionError(`unhandled binary op: ${op}`);
      }
    }
    case 'Un': {
      const v = evalNode(n.arg, s);
      if (n.op === '!') return !v;
      return -Number(v);
    }
    case 'Cond': {
      return evalNode(n.test, s) ? evalNode(n.cons, s) : evalNode(n.alt, s);
    }
  }
}

export function evaluate(ast: AST, scope: Scope): unknown {
  try {
    const v = evalNode(ast, scope);
    if (isPending(v)) return undefined;
    return v;
  } catch (err) {
    if (err instanceof ExpressionError || err instanceof ParseError || err instanceof TokenizeError) {
      throw err;
    }
    // Wrap native runtime exceptions (TypeError from Symbol coercion, etc.)
    // so callers only ever see typed errors from the engine.
    const msg = err instanceof Error ? err.message : String(err);
    throw new ExpressionError(`evaluation failed: ${msg}`);
  }
}

/* ── AST printer (for round-trip) ────────────────────────────────────────── */

export function printAst(node: AST | null | undefined): string | null {
  if (!node) return null;
  try { return printInner(node); } catch { return null; }
}
function printInner(n: AST): string {
  switch (n.kind) {
    case 'Lit': {
      if (typeof n.value === 'string') return JSON.stringify(n.value);
      if (n.value === null) return 'null';
      if (n.value === undefined) return 'undefined';
      return String(n.value);
    }
    case 'Id': return n.name;
    case 'Member': return `${printInner(n.object)}.${n.property}`;
    case 'Index':  return `${printInner(n.object)}[${printInner(n.index)}]`;
    case 'Call':   return `${printInner(n.callee)}(${n.args.map(printInner).join(', ')})`;
    case 'Bin':    return `(${printInner(n.left)} ${n.op} ${printInner(n.right)})`;
    case 'Un':     return `${n.op}${printInner(n.arg)}`;
    case 'Cond':   return `(${printInner(n.test)} ? ${printInner(n.cons)} : ${printInner(n.alt)})`;
  }
}

/* ───────────────────────────────────────────────────────────────────────────
 * Deterministic PRNG (mulberry32) — fixed seed by default.
 * ─────────────────────────────────────────────────────────────────────────── */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Random expression generator ─────────────────────────────────────────── */

const IDENTS = ['$json', '$vars', '$node', '$input', '$env', '$now', 'name', 'foo', 'bar', 'count', 'JSON', 'Math'];
const STRING_METHOD_NAMES = ['trim', 'toUpperCase', 'toLowerCase', 'includes', 'split', 'length'];
const ARRAY_METHOD_NAMES = ['join', 'first', 'last', 'length'];
const BINOPS = ['+', '-', '*', '/', '%', '==', '!=', '===', '!==', '<', '>', '<=', '>=', '&&', '||'];
const UNOPS_LIST = ['!', '-'];

type Rand = () => number;
const pick = <T>(r: Rand, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
const randInt = (r: Rand, lo: number, hi: number) => Math.floor(r() * (hi - lo + 1)) + lo;

function randLiteral(r: Rand): string {
  const w = randInt(r, 0, 4);
  if (w === 0) return String(randInt(r, -50, 50));
  if (w === 1) return (randInt(r, 0, 9999) / 100).toString();
  if (w === 2) return JSON.stringify(`s${randInt(r, 0, 999)}`);
  if (w === 3) return pick(r, ['true', 'false', 'null', 'undefined']);
  return '""';
}

function genWellFormed(r: Rand, depth: number): string {
  if (depth <= 0 || r() < 0.3) {
    if (r() < 0.5) return randLiteral(r);
    return pick(r, IDENTS);
  }
  const b = randInt(r, 0, 9);
  if (b === 0) {
    let s = pick(r, IDENTS);
    const hops = randInt(r, 1, 3);
    for (let h = 0; h < hops; h++) {
      s += r() < 0.5
        ? `.${pick(r, ['foo', 'bar', 'x', 'y', 'value', 'json'])}`
        : `[${randInt(r, 0, 5)}]`;
    }
    return s;
  }
  if (b === 1) {
    const recv = JSON.stringify('  abc  ');
    const m = pick(r, STRING_METHOD_NAMES);
    if (m === 'length') return `${recv}.length`;
    if (m === 'split' || m === 'includes') return `${recv}.${m}(",")`;
    return `${recv}.${m}()`;
  }
  if (b === 2) {
    const m = pick(r, ARRAY_METHOD_NAMES);
    if (m === 'length') return `$vars.tags.length`;
    if (m === 'join') return `$vars.tags.join("-")`;
    return `$vars.tags.${m}()`;
  }
  if (b === 3) {
    return `(${genWellFormed(r, depth - 1)} ${pick(r, BINOPS)} ${genWellFormed(r, depth - 1)})`;
  }
  if (b === 4) return `${pick(r, UNOPS_LIST)}${genWellFormed(r, depth - 1)}`;
  if (b === 5) return `(${genWellFormed(r, depth - 1)} ? ${genWellFormed(r, depth - 1)} : ${genWellFormed(r, depth - 1)})`;
  if (b === 6) return `${pick(r, ['String', 'Number', 'Boolean'])}(${genWellFormed(r, depth - 1)})`;
  if (b === 7) return `JSON.stringify(${genWellFormed(r, depth - 1)})`;
  if (b === 8) return `Math.${pick(r, ['floor', 'ceil', 'round', 'abs'])}(${genWellFormed(r, depth - 1)})`;
  return `(${genWellFormed(r, depth - 1)})`;
}

function mangle(r: Rand, source: string): string {
  if (source.length === 0) return '@';
  const which = randInt(r, 0, 6);
  const idx = randInt(r, 0, source.length - 1);
  if (which === 0) return source.slice(0, idx) + source.slice(idx + 1);
  if (which === 1) return source.slice(0, idx) + pick(r, ['@', '#', '~', '\\']) + source.slice(idx);
  if (which === 2) return source + ' +';
  if (which === 3) return '(' + source;
  if (which === 4) return source + ')';
  if (which === 5) return source.replace(/[()]/g, '');
  return source + ' "unterminated';
}

function generateInput(r: Rand): { source: string; wellFormed: boolean } {
  const wantMalformed = r() < 0.4;
  const base = genWellFormed(r, randInt(r, 1, 4));
  if (wantMalformed) return { source: mangle(r, base), wellFormed: false };
  return { source: base, wellFormed: true };
}

function makeScope(): Scope {
  return {
    json: { foo: 'bar', x: 7, items: [1, 2, 3] },
    input: { item: { json: { qty: 2 } }, all: [{ json: { id: 'a' } }] },
    node: { Test: { json: { value: 't' } } },
    vars: { name: 'Alice', tags: ['a', 'b', 'c'] },
    env: { API_KEY: 'k' },
    now: new Date('2026-01-01T00:00:00Z'),
    workflow: { id: 'w', name: 'W' },
    execution: { id: 'e', mode: 'test' },
  };
}

function isExpectedError(err: unknown): err is ExpressionError | ParseError | TokenizeError {
  return err instanceof ExpressionError || err instanceof ParseError || err instanceof TokenizeError;
}

function normalizeAst(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(normalizeAst);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(node as Record<string, unknown>).sort()) {
      if (k === 'pos' || k === 'start' || k === 'end') continue;
      out[k] = normalizeAst((node as Record<string, unknown>)[k]);
    }
    return out;
  }
  return node;
}

/* ── The fuzz test ───────────────────────────────────────────────────────── */

const DEFAULT_SEED = 0xC0FFEE;
const ITERATIONS = 5000;

test('fuzz: 5000 random expressions never crash and only raise typed errors', () => {
  const seed = Number(process.env.SABFLOW_FUZZ_SEED ?? DEFAULT_SEED);
  const rand = mulberry32(seed);
  const scope = makeScope();

  for (let i = 0; i < ITERATIONS; i++) {
    const { source, wellFormed } = generateInput(rand);
    try {
      const tokens = tokenize(source);
      const ast = parse(tokens);
      try {
        evaluate(ast, scope);
      } catch (evalErr) {
        if (!isExpectedError(evalErr)) {
          assert.fail(
            `evaluator threw a non-typed error at iteration ${i} (seed=${seed}, source=${JSON.stringify(source)}): ${
              evalErr instanceof Error ? `${evalErr.name}: ${evalErr.message}` : String(evalErr)
            }`,
          );
        }
      }
      if (wellFormed) {
        const printed = printAst(ast);
        if (printed !== null) {
          let reTokens: Token[];
          let reAst: AST;
          try {
            reTokens = tokenize(printed);
            reAst = parse(reTokens);
          } catch (rtErr) {
            assert.fail(
              `round-trip reparse failed at iteration ${i} (seed=${seed}, source=${JSON.stringify(source)}, printed=${JSON.stringify(printed)}): ${
                rtErr instanceof Error ? rtErr.message : String(rtErr)
              }`,
            );
            continue;
          }
          assert.deepStrictEqual(
            normalizeAst(reAst),
            normalizeAst(ast),
            `round-trip AST mismatch (seed=${seed}, i=${i}, source=${JSON.stringify(source)}, printed=${JSON.stringify(printed)})`,
          );
        }
      }
    } catch (err) {
      if (!isExpectedError(err)) {
        assert.fail(
          `iteration ${i} threw a non-typed error (seed=${seed}, source=${JSON.stringify(source)}): ${
            err instanceof Error ? `${err.name}: ${err.message}` : String(err)
          }`,
        );
      }
    }
  }
});
