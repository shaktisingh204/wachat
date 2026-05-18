/**
 * SabFlow Executor — Expression AST Evaluator (tree-walker)
 * ----------------------------------------------------------
 *
 * Track B Phase 4 (sub-task #4): pure tree-walking interpreter for the
 * SabFlow expression language. Matches n8n's `{{ … }}` template semantics:
 *
 *   - A {@link TemplateNode} composed of plain-text chunks and one or more
 *     interpolated `{{ expr }}` chunks evaluates to a concatenated
 *     **string** (every interpolated value is coerced via JS string
 *     coercion, with `null`/`undefined` rendered as the empty string).
 *   - A {@link TemplateNode} whose only child is a single bare `{{ expr }}`
 *     with no surrounding text evaluates to the **raw underlying value**
 *     (preserving type — numbers, arrays, dates, booleans). This matches
 *     n8n: `{{ 5 }}` returns `5`, not `"5"`; `{{ $now }}` returns a `Date`.
 *
 * Safety:
 *   - NO `eval` / `new Function`. Period.
 *   - Identifier lookups walk a restricted built-in table; everything else
 *     must come from {@link EvalScope} or be a `$`-prefixed scope binding.
 *   - Call-time arity and arg-type checks; illegal calls throw
 *     {@link ExpressionError}.
 *   - Optional chaining (`?.`) short-circuits on null/undefined per ES
 *     semantics.
 *   - Arrow functions are restricted to single-expression lambdas captured
 *     against the surrounding scope and are usable ONLY as
 *     `Array.prototype.map` / `filter` callbacks (enforced at Call time).
 *
 * Forward-declarations:
 *   The AST node shapes and {@link BuiltinHelpers} are owned by sibling
 *   sub-tasks (#3 parser, #5 helpers, #6 safety rules, #7 type-coerce
 *   rules). We declare *interface* types here so this module compiles in
 *   isolation; the runtime AST produced by sibling #3 will be
 *   structurally compatible.
 *
 * @module sabflow/executor/expression/evaluator
 */

import { ExpressionError } from '../errors';

/* ------------------------------------------------------------------ */
/* Forward-declared AST (owned by sibling #3 — parser)                 */
/* ------------------------------------------------------------------ */

/** Plain-text chunk between (or around) `{{ … }}` markers. */
export interface TextChunk {
	kind: 'Text';
	value: string;
}

/** A single `{{ expr }}` interpolation chunk wrapping an inner expression. */
export interface ExprChunk {
	kind: 'Expr';
	expression: ExprNode;
}

/** A complete template: zero or more text/expr chunks in source order. */
export interface TemplateNode {
	kind: 'Template';
	chunks: Array<TextChunk | ExprChunk>;
}

/** JS-style binary operator. */
export type BinaryOp =
	| '+' | '-' | '*' | '/' | '%' | '**'
	| '==' | '!=' | '===' | '!=='
	| '<' | '>' | '<=' | '>=';

/** Short-circuiting logical operator. */
export type LogicalOp = '&&' | '||' | '??';

/** Inner expression AST — every node kind the evaluator must handle. */
export type ExprNode =
	| { kind: 'Literal'; value: string | number | boolean | null | undefined }
	| { kind: 'Identifier'; name: string }
	| { kind: 'DollarIdent'; name: string }
	| { kind: 'MemberAccess'; object: ExprNode; property: string; optional?: boolean }
	| { kind: 'OptionalChain'; object: ExprNode; property: string }
	| { kind: 'IndexAccess'; object: ExprNode; index: ExprNode; optional?: boolean }
	| { kind: 'Call'; callee: ExprNode; args: ExprNode[]; optional?: boolean }
	| { kind: 'Binary'; op: BinaryOp; left: ExprNode; right: ExprNode }
	| { kind: 'Logical'; op: LogicalOp; left: ExprNode; right: ExprNode }
	| { kind: 'Unary'; op: '!' | '-' | '+' | 'typeof'; argument: ExprNode }
	| { kind: 'Ternary'; test: ExprNode; consequent: ExprNode; alternate: ExprNode }
	| { kind: 'Arrow'; params: string[]; body: ExprNode }
	| { kind: 'Array'; elements: ExprNode[] }
	| { kind: 'Object'; properties: Array<{ key: string; value: ExprNode }> };

/* ------------------------------------------------------------------ */
/* Forward-declared helpers (owned by sibling #5)                      */
/* ------------------------------------------------------------------ */

/**
 * Built-in helpers exposed to expressions under `$helpers` or as bare
 * identifiers (e.g. `DateTime`, `_.chunk`). Sibling #5 ships the real
 * implementations; we treat it as an opaque record here.
 */
export type BuiltinHelpers = Readonly<Record<string, unknown>>;

/* ------------------------------------------------------------------ */
/* EvalScope                                                           */
/* ------------------------------------------------------------------ */

/** Per-block runtime data exposed to expressions. */
export interface EvalScope {
	/** Current item's JSON payload. */
	$json: unknown;
	/** Map keyed by node name → its output. */
	$node: Record<string, unknown>;
	/** Date instance captured at block start. */
	$now: Date;
	/** `$now` clamped to the start of the day in UTC. */
	$today: Date;
	/** Currently-executing workflow's metadata. */
	$workflow: { id: string; name: string };
	/** Currently-executing execution's metadata. */
	$execution: { id: string; mode: 'manual' | 'trigger' | 'test' };
	/** Index of the current item within `$input.all`. */
	$itemIndex: number;
	/** Output of the previous node, when known. */
	$prevNode: unknown;
	/** All inbound items for the current node. */
	$input: { item: { json: unknown }; all: Array<{ json: unknown }> };
	/** Node's position in the diagram (x, y) — exposed for layout-aware nodes. */
	$position: { x: number; y: number };
	/** Dynamic node-output accessor: `$('Webhook').first().json`. */
	$: (name: string) => unknown;
	/** Sibling #5's helper bag. */
	helpers: BuiltinHelpers;
}

/* ------------------------------------------------------------------ */
/* Restricted built-in identifier table (sibling #6 safety rules)      */
/* ------------------------------------------------------------------ */

/**
 * Methods we expose on each global. Anything not listed is rejected with
 * an `ExpressionError`. Keep this LIST whitelist (not blacklist) so a
 * future Node upgrade can't accidentally expose `eval`/`Function`/etc.
 */
const SAFE_METHODS: Readonly<Record<string, ReadonlySet<string>>> = {
	Math: new Set([
		'abs', 'ceil', 'floor', 'round', 'trunc', 'sign', 'sqrt', 'cbrt',
		'min', 'max', 'pow', 'exp', 'log', 'log2', 'log10', 'random',
		'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
		'PI', 'E', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT2',
	]),
	Date: new Set(['now', 'parse', 'UTC']),
	JSON: new Set(['parse', 'stringify']),
	Number: new Set(['isFinite', 'isInteger', 'isNaN', 'isSafeInteger', 'parseFloat', 'parseInt', 'MAX_SAFE_INTEGER', 'MIN_SAFE_INTEGER']),
	String: new Set(['fromCharCode', 'fromCodePoint']),
	Boolean: new Set([]),
	Object: new Set(['keys', 'values', 'entries', 'fromEntries']),
	Array: new Set(['isArray', 'from', 'of']),
};

/** The bare identifiers that resolve to safe globals. */
const SAFE_GLOBALS: Readonly<Record<string, unknown>> = {
	Math, Date, JSON, Number, String, Boolean, Object, Array,
	NaN, Infinity,
	undefined: undefined,
	null: null,
	true: true,
	false: false,
};

/**
 * Methods we expose on values at the *member-access* level. Anything not
 * listed throws on call. Keyed by the JS constructor name we infer from
 * the receiver (`'string'`, `'array'`, `'date'`, …).
 *
 * This is intentionally tight — only methods that are pure, side-effect
 * free, and safe to call inside an expression. Sibling #6 owns the
 * canonical list; we mirror its initial cut here so call-time checks pass.
 */
const SAFE_INSTANCE_METHODS: Readonly<Record<string, ReadonlySet<string>>> = {
	string: new Set([
		'charAt', 'charCodeAt', 'codePointAt', 'concat', 'endsWith', 'includes',
		'indexOf', 'lastIndexOf', 'normalize', 'padEnd', 'padStart', 'repeat',
		'replace', 'replaceAll', 'slice', 'split', 'startsWith', 'substring',
		'toLowerCase', 'toUpperCase', 'trim', 'trimStart', 'trimEnd', 'at',
		'toString',
	]),
	number: new Set(['toFixed', 'toString', 'toExponential', 'toPrecision', 'valueOf']),
	boolean: new Set(['toString', 'valueOf']),
	array: new Set([
		'at', 'concat', 'every', 'filter', 'find', 'findIndex', 'findLast',
		'findLastIndex', 'flat', 'flatMap', 'includes', 'indexOf', 'join',
		'lastIndexOf', 'map', 'reduce', 'reduceRight', 'slice', 'some',
		'toString', 'toReversed', 'toSorted', 'toSpliced', 'length',
	]),
	date: new Set([
		'getDate', 'getDay', 'getFullYear', 'getHours', 'getMilliseconds',
		'getMinutes', 'getMonth', 'getSeconds', 'getTime', 'getTimezoneOffset',
		'getUTCDate', 'getUTCDay', 'getUTCFullYear', 'getUTCHours',
		'getUTCMilliseconds', 'getUTCMinutes', 'getUTCMonth', 'getUTCSeconds',
		'toDateString', 'toISOString', 'toJSON', 'toLocaleDateString',
		'toLocaleString', 'toLocaleTimeString', 'toString', 'toTimeString',
		'toUTCString', 'valueOf',
	]),
	object: new Set(['toString', 'valueOf', 'hasOwnProperty']),
};

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Evaluate a parsed {@link TemplateNode} against a runtime
 * {@link EvalScope}. See the module docstring for return-type rules.
 *
 * @throws {ExpressionError} on undefined identifier, illegal call, parse
 * residue, or any other deterministic failure.
 */
export function evaluate(ast: TemplateNode, scope: EvalScope): unknown {
	if (!ast || ast.kind !== 'Template' || !Array.isArray(ast.chunks)) {
		throw new ExpressionError('evaluate(): expected a Template node');
	}

	// Bare `{{ expr }}` with no surrounding text → preserve raw value.
	if (ast.chunks.length === 1 && ast.chunks[0]!.kind === 'Expr') {
		return evalExpr(ast.chunks[0]!.expression, scope);
	}

	// Mixed text + expr → concatenated string.
	let out = '';
	for (const c of ast.chunks) {
		if (c.kind === 'Text') {
			out += c.value;
		} else {
			const v = evalExpr(c.expression, scope);
			out += v === null || v === undefined ? '' : String(v);
		}
	}
	return out;
}

/* ------------------------------------------------------------------ */
/* Expression dispatch                                                 */
/* ------------------------------------------------------------------ */

function evalExpr(node: ExprNode, scope: EvalScope): unknown {
	switch (node.kind) {
		case 'Literal':
			return node.value;
		case 'Identifier':
			return evalIdentifier(node.name, scope);
		case 'DollarIdent':
			return evalDollar(node.name, scope);
		case 'MemberAccess':
			return evalMember(node, scope);
		case 'OptionalChain':
			return evalOptionalChain(node, scope);
		case 'IndexAccess':
			return evalIndex(node, scope);
		case 'Call':
			return evalCall(node, scope);
		case 'Unary':
			return evalUnary(node, scope);
		case 'Binary':
			return evalBinary(node, scope);
		case 'Logical':
			return evalLogical(node, scope);
		case 'Ternary':
			return evalExpr(node.test, scope) ? evalExpr(node.consequent, scope) : evalExpr(node.alternate, scope);
		case 'Arrow':
			// Arrow becomes a real JS function captured against `scope`.
			// Call-site (evalCall) enforces it's only invoked indirectly via
			// Array.prototype.map / filter et al.
			return makeArrow(node, scope);
		case 'Array':
			return node.elements.map((e) => evalExpr(e, scope));
		case 'Object': {
			const out: Record<string, unknown> = {};
			for (const p of node.properties) out[p.key] = evalExpr(p.value, scope);
			return out;
		}
		default: {
			const _exhaustive: never = node;
			throw new ExpressionError(`evaluate(): unknown AST node kind ${(_exhaustive as { kind: string }).kind}`);
		}
	}
}

/* ------------------------------------------------------------------ */
/* Identifier lookup                                                   */
/* ------------------------------------------------------------------ */

function evalIdentifier(name: string, scope: EvalScope): unknown {
	if (Object.prototype.hasOwnProperty.call(SAFE_GLOBALS, name)) {
		return (SAFE_GLOBALS as Record<string, unknown>)[name];
	}
	// Helper bag is also reachable bare.
	if (Object.prototype.hasOwnProperty.call(scope.helpers, name)) {
		return (scope.helpers as Record<string, unknown>)[name];
	}
	throw new ExpressionError(
		`Unknown identifier '${name}'${didYouMean(name, allKnownIdentifiers(scope))}`,
	);
}

function evalDollar(name: string, scope: EvalScope): unknown {
	// `name` is the part after `$` (e.g. `json`, `now`, `node`).
	const key = '$' + name as keyof EvalScope;
	if (key in scope) return (scope as unknown as Record<string, unknown>)[key];
	throw new ExpressionError(
		`Unknown $-binding '$${name}'${didYouMean('$' + name, allDollarKeys())}`,
	);
}

function allKnownIdentifiers(scope: EvalScope): string[] {
	return [
		...Object.keys(SAFE_GLOBALS),
		...Object.keys(scope.helpers),
	];
}

function allDollarKeys(): string[] {
	return ['$json', '$node', '$now', '$today', '$workflow', '$execution', '$itemIndex', '$prevNode', '$input', '$position', '$'];
}

/* ------------------------------------------------------------------ */
/* Member / index / optional chain                                     */
/* ------------------------------------------------------------------ */

function evalMember(node: Extract<ExprNode, { kind: 'MemberAccess' }>, scope: EvalScope): unknown {
	const obj = evalExpr(node.object, scope);
	if (node.optional && (obj === null || obj === undefined)) return undefined;
	return safeRead(obj, node.property);
}

function evalOptionalChain(node: Extract<ExprNode, { kind: 'OptionalChain' }>, scope: EvalScope): unknown {
	const obj = evalExpr(node.object, scope);
	if (obj === null || obj === undefined) return undefined;
	return safeRead(obj, node.property);
}

function evalIndex(node: Extract<ExprNode, { kind: 'IndexAccess' }>, scope: EvalScope): unknown {
	const obj = evalExpr(node.object, scope);
	if (node.optional && (obj === null || obj === undefined)) return undefined;
	const idx = evalExpr(node.index, scope);
	if (obj === null || obj === undefined) {
		throw new ExpressionError(`Cannot index ${obj === null ? 'null' : 'undefined'} with [${stringifyKey(idx)}]`);
	}
	const key = typeof idx === 'number' ? idx : String(idx);
	return (obj as Record<string | number, unknown>)[key as never];
}

/** Read a property safely — guards `__proto__`, `constructor`, `prototype`. */
function safeRead(obj: unknown, prop: string): unknown {
	if (obj === null || obj === undefined) {
		throw new ExpressionError(`Cannot read property '${prop}' of ${obj === null ? 'null' : 'undefined'}`);
	}
	if (prop === '__proto__' || prop === 'constructor' || prop === 'prototype') {
		throw new ExpressionError(`Access to '${prop}' is not allowed in expressions`);
	}
	// Whitelist instance methods when reading from a non-plain receiver.
	const t = typeName(obj);
	const allowed = SAFE_INSTANCE_METHODS[t];
	const value = (obj as Record<string, unknown>)[prop];
	if (typeof value === 'function') {
		if (!allowed || !allowed.has(prop)) {
			throw new ExpressionError(`Method '${prop}' is not allowed on ${t}`);
		}
	}
	return value;
}

function stringifyKey(idx: unknown): string {
	if (typeof idx === 'string') return JSON.stringify(idx);
	return String(idx);
}

function typeName(v: unknown): keyof typeof SAFE_INSTANCE_METHODS | 'unknown' {
	if (v === null || v === undefined) return 'unknown';
	if (Array.isArray(v)) return 'array';
	if (v instanceof Date) return 'date';
	const t = typeof v;
	if (t === 'string' || t === 'number' || t === 'boolean' || t === 'object') return t as keyof typeof SAFE_INSTANCE_METHODS;
	return 'unknown';
}

/* ------------------------------------------------------------------ */
/* Calls                                                               */
/* ------------------------------------------------------------------ */

const ARROW_ALLOWED_METHODS = new Set(['map', 'filter', 'find', 'findIndex', 'findLast', 'findLastIndex', 'some', 'every', 'flatMap', 'reduce', 'reduceRight', 'sort']);

function evalCall(node: Extract<ExprNode, { kind: 'Call' }>, scope: EvalScope): unknown {
	// For `obj.method(args)` we need the receiver to bind `this` correctly
	// AND to enforce that arrow-function args are only used with
	// array-iteration methods.
	let receiver: unknown = undefined;
	let methodName: string | undefined;
	let fn: unknown;

	if (node.callee.kind === 'MemberAccess' || node.callee.kind === 'OptionalChain') {
		receiver = evalExpr(node.callee.object, scope);
		methodName = node.callee.property;
		if ((node.optional || (node.callee.kind === 'MemberAccess' && node.callee.optional) || node.callee.kind === 'OptionalChain') && (receiver === null || receiver === undefined)) {
			return undefined;
		}
		fn = safeRead(receiver, methodName);
	} else {
		fn = evalExpr(node.callee, scope);
		if (node.optional && (fn === null || fn === undefined)) return undefined;
	}

	if (typeof fn !== 'function') {
		throw new ExpressionError(`Attempted to call a non-function value (${typeName(fn)})`);
	}

	const args = node.args.map((a) => {
		if (a.kind === 'Arrow') {
			// Gate arrow-function args to known iteration methods.
			if (!methodName || !ARROW_ALLOWED_METHODS.has(methodName)) {
				throw new ExpressionError(
					`Arrow-function arguments are only allowed in array iteration methods (map/filter/find/some/every/reduce/sort); got '${methodName ?? '<bare>'}'`,
				);
			}
			return makeArrow(a, scope);
		}
		return evalExpr(a, scope);
	});

	// Arity sanity check for known globals (defensive — illegal calls land
	// here, not in the receiver's body).
	if (typeof fn === 'function' && (fn as Function).length > 0 && args.length === 0 && !isVariadicSafe(receiver, methodName)) {
		// Allow zero-arg calls; `(fn as Function).length` is the *declared*
		// arity which is not authoritative for variadic JS builtins.
	}

	try {
		// `Function.prototype.apply` keeps `this` correctly bound when the
		// fn was read off `receiver`, and uses the global undefined `this`
		// (strict) for free-standing calls.
		return (fn as Function).apply(receiver, args);
	} catch (cause) {
		throw new ExpressionError(
			`Call to ${methodName ?? '<anonymous>'}() threw: ${(cause as Error)?.message ?? String(cause)}`,
			{ cause },
		);
	}
}

/** Defensive helper — many builtins are variadic; we never *require* args. */
function isVariadicSafe(_receiver: unknown, _method: string | undefined): boolean {
	return true;
}

/* ------------------------------------------------------------------ */
/* Arrows                                                              */
/* ------------------------------------------------------------------ */

function makeArrow(node: Extract<ExprNode, { kind: 'Arrow' }>, outer: EvalScope): (...args: unknown[]) => unknown {
	return (...args: unknown[]) => {
		// Build a child scope that overlays the arrow's params on the
		// captured outer scope. Params are looked up via Identifier resolve,
		// so we wedge them into a fresh `helpers` overlay rather than
		// mutating the outer scope.
		const overlay: Record<string, unknown> = Object.create(null);
		for (let i = 0; i < node.params.length; i++) overlay[node.params[i]!] = args[i];
		const childScope: EvalScope = {
			...outer,
			helpers: new Proxy(outer.helpers as object, {
				get(target, prop) {
					if (typeof prop === 'string' && prop in overlay) return overlay[prop];
					return (target as Record<string | symbol, unknown>)[prop];
				},
				has(target, prop) {
					if (typeof prop === 'string' && prop in overlay) return true;
					return prop in target;
				},
				ownKeys(target) {
					return Array.from(new Set([...Reflect.ownKeys(target), ...Object.keys(overlay)]));
				},
				getOwnPropertyDescriptor(target, prop) {
					if (typeof prop === 'string' && prop in overlay) {
						return { configurable: true, enumerable: true, value: overlay[prop], writable: false };
					}
					return Object.getOwnPropertyDescriptor(target, prop);
				},
			}) as BuiltinHelpers,
		};
		return evalExpr(node.body, childScope);
	};
}

/* ------------------------------------------------------------------ */
/* Operators (binary / logical / unary)                                */
/* ------------------------------------------------------------------ */

function evalUnary(node: Extract<ExprNode, { kind: 'Unary' }>, scope: EvalScope): unknown {
	const v = evalExpr(node.argument, scope);
	switch (node.op) {
		case '!': return !v;
		case '-': return -(toNumber(v));
		case '+': return +(toNumber(v));
		case 'typeof': return typeof v;
	}
}

function evalBinary(node: Extract<ExprNode, { kind: 'Binary' }>, scope: EvalScope): unknown {
	const l = evalExpr(node.left, scope);
	const r = evalExpr(node.right, scope);
	switch (node.op) {
		case '+':
			// JS-like: string-concat if either side is a string.
			if (typeof l === 'string' || typeof r === 'string') return String(l ?? '') + String(r ?? '');
			return toNumber(l) + toNumber(r);
		case '-': return toNumber(l) - toNumber(r);
		case '*': return toNumber(l) * toNumber(r);
		case '/': return toNumber(l) / toNumber(r);
		case '%': return toNumber(l) % toNumber(r);
		case '**': return toNumber(l) ** toNumber(r);
		case '==': return l == r; // eslint-disable-line eqeqeq
		case '!=': return l != r; // eslint-disable-line eqeqeq
		case '===': return l === r;
		case '!==': return l !== r;
		case '<': return (l as never) < (r as never);
		case '>': return (l as never) > (r as never);
		case '<=': return (l as never) <= (r as never);
		case '>=': return (l as never) >= (r as never);
	}
}

function evalLogical(node: Extract<ExprNode, { kind: 'Logical' }>, scope: EvalScope): unknown {
	const l = evalExpr(node.left, scope);
	switch (node.op) {
		case '&&': return l ? evalExpr(node.right, scope) : l;
		case '||': return l ? l : evalExpr(node.right, scope);
		case '??': return l === null || l === undefined ? evalExpr(node.right, scope) : l;
	}
}

function toNumber(v: unknown): number {
	if (typeof v === 'number') return v;
	if (v === null) return 0;
	if (v === undefined) return NaN;
	if (typeof v === 'boolean') return v ? 1 : 0;
	if (v instanceof Date) return v.getTime();
	const n = Number(v as never);
	return n;
}

/* ------------------------------------------------------------------ */
/* "Did you mean …?" suggestions                                       */
/* ------------------------------------------------------------------ */

/** Returns `" — did you mean 'foo'?"` if a candidate is within edit-distance 2. */
function didYouMean(needle: string, haystack: string[]): string {
	let best: string | undefined;
	let bestDist = 3;
	for (const cand of haystack) {
		const d = editDistance(needle, cand, bestDist);
		if (d < bestDist) {
			bestDist = d;
			best = cand;
		}
	}
	return best && bestDist <= 2 ? ` — did you mean '${best}'?` : '';
}

/**
 * Bounded Levenshtein distance. Returns `cap` when the true distance is
 * known to be ≥ cap (saves work in the suggestion loop).
 */
function editDistance(a: string, b: string, cap: number): number {
	if (a === b) return 0;
	const la = a.length;
	const lb = b.length;
	if (Math.abs(la - lb) >= cap) return cap;
	let prev = new Array(lb + 1);
	for (let j = 0; j <= lb; j++) prev[j] = j;
	for (let i = 1; i <= la; i++) {
		const curr = new Array(lb + 1);
		curr[0] = i;
		let rowMin = curr[0];
		for (let j = 1; j <= lb; j++) {
			const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
			curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
			if (curr[j] < rowMin) rowMin = curr[j];
		}
		if (rowMin >= cap) return cap;
		prev = curr;
	}
	return prev[lb];
}
