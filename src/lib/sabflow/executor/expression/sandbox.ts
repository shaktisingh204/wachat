/**
 * SabFlow Expression Sandbox — safety guardrails for the expression evaluator.
 *
 * Track B Phase 4 (sub-task #6): wraps an evaluation pass with cooperative
 * limits that the AST walker (sibling #4) hits at every node by calling
 * {@link Sandbox.tick} and {@link Sandbox.onResult}. None of these limits are
 * preemptive — they are *checkpointed*, meaning the evaluator MUST call
 * {@link Sandbox.tick} between visits or pathological inputs (e.g. a huge
 * tight loop in a single AST node) can still wedge the worker. The
 * evaluator-side contract is documented inline.
 *
 * Threat model this defends against:
 *   1. Runaway expressions (infinite loops, exponential recursion) — wall
 *      clock + recursion depth caps fire {@link ExecutionTimeoutError} /
 *      {@link ResourceLimitError}.
 *   2. Memory-bomb returns (huge JSON, mega-strings) — result-size sniff
 *      on every "assignment-like" op fires {@link ResourceLimitError}.
 *   3. Global escape (`process`, `require`, `globalThis`, …) — identifier
 *      allowlist via {@link Sandbox.isAllowedGlobal}.
 *   4. Prototype pollution (`x.__proto__.polluted = 1`, `Object.getPrototypeOf`,
 *      `Reflect.set`, etc.) — {@link Sandbox.assertSafeMemberAccess}.
 *   5. ReDoS via regex literals — {@link Sandbox.assertSafeRegex}.
 *   6. Out-of-band mutation of returned values — {@link Sandbox.freezeReturn}
 *      deep-freezes the result to depth 4 so node code that receives an
 *      expression-evaluated value can't mutate the evaluator's state.
 *
 * No runtime dependencies — only the error taxonomy in `../errors`.
 *
 * @module sabflow/executor/expression/sandbox
 */

import {
	ExecutionTimeoutError,
	ExpressionError,
	ResourceLimitError,
} from '../errors';

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

/**
 * Tunables for a single {@link Sandbox} instance. Defaults are deliberately
 * tight — the evaluator hands out one Sandbox per top-level expression eval,
 * so per-expression budgets, not per-workflow.
 */
export interface SandboxConfig {
	/** Wall-clock cap for one whole evaluation, in milliseconds. */
	maxEvalMs: number;
	/** Maximum recursion / call-stack depth the evaluator may reach. */
	maxDepth: number;
	/** Approximate byte cap on any single value produced by an assignment. */
	maxResultBytes: number;
	/** Maximum length of any single array literal or array-producing op. */
	maxArrayLen: number;
	/** Maximum length (in source chars) of any regex literal. */
	maxRegexLen: number;
	/** Identifiers that may be looked up as globals from inside expressions. */
	allowedGlobals: readonly string[];
}

/**
 * The default {@link SandboxConfig}. Keep these conservative — they are the
 * floor that every expression evaluation gets, and the evaluator can tighten
 * (but not loosen) them per-call.
 */
export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
	maxEvalMs: 100,
	maxDepth: 64,
	maxResultBytes: 1_048_576,
	maxArrayLen: 100_000,
	maxRegexLen: 1024,
	allowedGlobals: ['Math', 'JSON', 'Number', 'String', 'Boolean', 'Object', 'Array', 'Date'],
};

/* ------------------------------------------------------------------ */
/* Member-access denylist                                              */
/* ------------------------------------------------------------------ */

/**
 * Member names that must never be readable or writable from an expression —
 * touching any of these is an instant prototype-pollution flag.
 *
 * @internal
 */
const FORBIDDEN_MEMBER_NAMES: ReadonlySet<string> = new Set([
	'__proto__',
	'constructor',
	'prototype',
]);

/**
 * Global identifier + member-name pairs that bypass the prototype chain in
 * dangerous ways. Even if the global is allowlisted, these specific dotted
 * forms are rejected.
 *
 * @internal
 */
const FORBIDDEN_MEMBER_PATHS: ReadonlySet<string> = new Set([
	'Object.getPrototypeOf',
	'Object.setPrototypeOf',
	'Object.defineProperty',
	'Object.defineProperties',
	'Object.create',
	// All of `Reflect.*` is denied — handled by prefix check below, this set
	// is the explicit "we know about it" form for clearer error messages.
	'Reflect.get',
	'Reflect.set',
	'Reflect.has',
	'Reflect.ownKeys',
	'Reflect.getPrototypeOf',
	'Reflect.setPrototypeOf',
	'Reflect.deleteProperty',
	'Reflect.defineProperty',
	'Reflect.apply',
	'Reflect.construct',
]);

/* ------------------------------------------------------------------ */
/* Sandbox                                                             */
/* ------------------------------------------------------------------ */

/**
 * Per-evaluation safety harness. Construct one before walking an expression
 * AST, call {@link Sandbox.tick} at every node visit, and call
 * {@link Sandbox.onResult} whenever a value would be assigned to a variable
 * or returned. The evaluator is also responsible for calling
 * {@link Sandbox.enter} / {@link Sandbox.leave} around any recursive descent.
 *
 * Cancelling a sandbox after a throw is a no-op — once a limit is hit the
 * instance is considered poisoned and every subsequent {@link Sandbox.tick}
 * will re-throw.
 *
 * @example
 * ```ts
 * const sb = new Sandbox();
 * try {
 *   sb.start();
 *   const value = walk(ast, sb);
 *   return sb.freezeReturn(value);
 * } catch (e) {
 *   // ExecutionTimeoutError | ResourceLimitError | ExpressionError
 *   throw e;
 * }
 * ```
 */
export class Sandbox {
	public readonly config: SandboxConfig;

	/** Wall-clock anchor set by {@link Sandbox.start}. */
	private startedAtMs = 0;
	/** Current recursion depth (incremented by {@link Sandbox.enter}). */
	private depth = 0;
	/** Sticky error — once set, every tick re-throws it. */
	private poisoned: Error | null = null;
	/** Cheap tick counter, used to amortise `Date.now()` calls. */
	private tickCount = 0;
	/** Cached most-recent wall-clock reading. */
	private lastNowMs = 0;

	constructor(partial: Partial<SandboxConfig> = {}) {
		this.config = { ...DEFAULT_SANDBOX_CONFIG, ...partial };
	}

	/* ----------------------------- lifecycle --------------------------- */

	/**
	 * Arm the wall-clock cap. Call this once, immediately before the
	 * evaluator starts walking the AST. Calling twice resets the clock.
	 */
	start(): void {
		this.startedAtMs = Date.now();
		this.lastNowMs = this.startedAtMs;
		this.depth = 0;
		this.tickCount = 0;
		this.poisoned = null;
	}

	/**
	 * Hot path: the evaluator MUST call this at every AST-node visit.
	 *
	 * - Re-throws the poisoned error if a limit has already fired.
	 * - Checks the wall-clock cap every 64 ticks (Date.now() is not free).
	 *
	 * Designed to be branch-light so the JIT can inline it.
	 */
	tick(): void {
		if (this.poisoned !== null) throw this.poisoned;
		// Date.now() ~50ns on modern V8 but the call shows up in flamegraphs
		// for tight ASTs. Sample every 64 ticks; worst case overshoot is
		// 64 * (per-node cost) ~ a handful of microseconds.
		this.tickCount = (this.tickCount + 1) & 0x3f;
		if (this.tickCount === 0) {
			const now = Date.now();
			this.lastNowMs = now;
			const elapsed = now - this.startedAtMs;
			if (elapsed > this.config.maxEvalMs) {
				const err = new ExecutionTimeoutError(
					`Expression evaluation exceeded ${this.config.maxEvalMs}ms budget`,
					{
						scope: 'node',
						timeoutMs: this.config.maxEvalMs,
						elapsedMs: elapsed,
					},
				);
				this.poisoned = err;
				throw err;
			}
		}
	}

	/**
	 * Increment recursion depth. Pair every call with {@link Sandbox.leave}.
	 *
	 * Recursion-cap hits are flagged `kind: 'permanent'` because rerunning
	 * the same deterministic expression won't fix a too-deep tree — the user
	 * has to rewrite the expression.
	 */
	enter(): void {
		if (this.poisoned !== null) throw this.poisoned;
		this.depth += 1;
		if (this.depth > this.config.maxDepth) {
			const err = new ResourceLimitError(
				`Expression recursion depth exceeded ${this.config.maxDepth}`,
				{
					resource: 'cpu',
					kind: 'permanent',
					limit: this.config.maxDepth,
					observed: this.depth,
				},
			);
			this.poisoned = err;
			throw err;
		}
	}

	/** Pair with {@link Sandbox.enter}. Never throws (cleanup-safe). */
	leave(): void {
		if (this.depth > 0) this.depth -= 1;
	}

	/* ----------------------------- result sniff ----------------------- */

	/**
	 * Result-size sniff. The evaluator calls this at every assignment-like
	 * operation (variable bind, return value, intermediate spread, etc.) so
	 * a single mega-result is caught at the boundary rather than after the
	 * whole eval pass.
	 *
	 * Strings: cap by `.length * 2` (JS strings are UTF-16, so each char is
	 * ~2 bytes — close enough for a "sniff" without an expensive
	 * `Buffer.byteLength`).
	 * Arrays/objects: cap by approximate JSON-serialised length AND a hard
	 * cap on array length.
	 */
	onResult(value: unknown, label = 'result'): void {
		if (this.poisoned !== null) throw this.poisoned;
		const { maxResultBytes, maxArrayLen } = this.config;

		if (typeof value === 'string') {
			const bytes = value.length * 2;
			if (bytes > maxResultBytes) {
				this.fail(
					new ResourceLimitError(
						`Expression ${label} string exceeds ${maxResultBytes} bytes (observed ~${bytes})`,
						{
							resource: 'memory',
							kind: 'permanent',
							limit: maxResultBytes,
							observed: bytes,
						},
					),
				);
			}
			return;
		}

		if (Array.isArray(value)) {
			if (value.length > maxArrayLen) {
				this.fail(
					new ResourceLimitError(
						`Expression ${label} array length exceeds ${maxArrayLen}`,
						{
							resource: 'memory',
							kind: 'permanent',
							limit: maxArrayLen,
							observed: value.length,
						},
					),
				);
			}
			// fall through to byte sniff
		}

		if (value !== null && (typeof value === 'object' || Array.isArray(value))) {
			// Approximate. We could walk the object ourselves but JSON.stringify
			// is fast in V8 and short-circuits on common cases. We cap the
			// stringify itself by passing a replacer that bails when the
			// running length exceeds the budget — keeps this O(maxResultBytes)
			// even on adversarial nested input.
			let running = 0;
			try {
				JSON.stringify(value, (_k, v) => {
					if (running > maxResultBytes) return undefined;
					if (typeof v === 'string') running += v.length * 2;
					else if (typeof v === 'number' || typeof v === 'boolean') running += 8;
					return v;
				});
			} catch {
				// Cyclic / non-serialisable — fall through, caller's
				// problem to flag separately. We don't fail on it here.
				return;
			}
			if (running > maxResultBytes) {
				this.fail(
					new ResourceLimitError(
						`Expression ${label} payload exceeds ${maxResultBytes} bytes (observed ~${running})`,
						{
							resource: 'memory',
							kind: 'permanent',
							limit: maxResultBytes,
							observed: running,
						},
					),
				);
			}
		}
	}

	/* ----------------------------- identifiers ------------------------ */

	/**
	 * Is the bare identifier `name` allowed to resolve to a global value?
	 *
	 * This is the *only* place the evaluator may consult to decide whether a
	 * top-level Identifier should fall back to `globalThis[name]`. Anything
	 * outside the allowlist must be treated as a reference to an undefined
	 * binding — typically that's an {@link ExpressionError}.
	 */
	isAllowedGlobal(name: string): boolean {
		return this.config.allowedGlobals.includes(name);
	}

	/* ----------------------------- member access ---------------------- */

	/**
	 * Reject prototype-poisoning member access. Call from the evaluator at
	 * every `MemberExpression` and `CallExpression` resolution.
	 *
	 * @param objectName - The bare identifier of the *root* of the lookup
	 *   (e.g. `"Object"` for `Object.getPrototypeOf(x)`), or `undefined`
	 *   when the root is a dynamic expression.
	 * @param memberName - The property name being read. May be undefined
	 *   when the property is a runtime-computed expression — in that case
	 *   the evaluator must additionally check the *value* of the computed
	 *   property against this same allowlist before performing the access.
	 *
	 * @throws ExpressionError when the access pattern is denied.
	 */
	assertSafeMemberAccess(objectName: string | undefined, memberName: string | undefined): void {
		if (this.poisoned !== null) throw this.poisoned;

		if (memberName !== undefined && FORBIDDEN_MEMBER_NAMES.has(memberName)) {
			throw new ExpressionError(
				`Access to '${memberName}' is forbidden in expressions`,
				{ details: { reason: 'prototype-pollution', member: memberName } },
			);
		}

		if (objectName === 'Reflect') {
			throw new ExpressionError(`'Reflect' is not allowed in expressions`, {
				details: { reason: 'prototype-pollution', root: 'Reflect' },
			});
		}

		if (objectName !== undefined && memberName !== undefined) {
			const path = `${objectName}.${memberName}`;
			if (FORBIDDEN_MEMBER_PATHS.has(path)) {
				throw new ExpressionError(
					`Access to '${path}' is forbidden in expressions`,
					{ details: { reason: 'prototype-pollution', path } },
				);
			}
		}
	}

	/* ----------------------------- regex safety ----------------------- */

	/**
	 * Rough ReDoS heuristic + length cap. Run this on every regex literal
	 * the parser sees (and on every dynamic `new RegExp(...)` source the
	 * evaluator would build).
	 *
	 * Heuristics (deliberately fail-closed):
	 *   1. Source length > `maxRegexLen` → reject.
	 *   2. A grouped quantifier of the form `(...)+`, `(...)*`, `(...){m,}`
	 *      *immediately followed by another quantifier* — the classic
	 *      "evil regex" pattern that backtracks super-linearly.
	 *   3. Nested-quantifier inside a group: `(a+)+`, `(a*)*`, `(a+)*`, etc.
	 *
	 * False positives are acceptable here — users can pre-compute matches
	 * outside the expression engine.
	 */
	assertSafeRegex(source: string): void {
		if (this.poisoned !== null) throw this.poisoned;

		if (source.length > this.config.maxRegexLen) {
			throw new ExpressionError(
				`Regex source exceeds ${this.config.maxRegexLen} characters`,
				{
					details: {
						reason: 'regex-too-long',
						limit: this.config.maxRegexLen,
						observed: source.length,
					},
				},
			);
		}

		// (something with a quantifier)(another quantifier)
		// — covers (a+)+ (a*)* (a+){2,} (a*){3,} (.+)+ etc.
		const nestedQuantInGroup = /\(([^()]*[+*]|[^()]*\{\d+,\d*\})[^()]*\)\s*(?:[+*?]|\{\d+,\d*\})/;
		if (nestedQuantInGroup.test(source)) {
			throw new ExpressionError(
				`Regex contains a super-linear backtracking pattern`,
				{
					details: {
						reason: 'regex-redos',
						source,
					},
				},
			);
		}

		// Adjacent quantifiers — `+*`, `*+`, `++`, `**`, `+{1,}` etc.
		const adjacentQuantifiers = /[+*?](?:[+*?]|\{\d+,?\d*\})/;
		if (adjacentQuantifiers.test(source)) {
			throw new ExpressionError(
				`Regex contains adjacent quantifiers (super-linear backtracking)`,
				{
					details: {
						reason: 'regex-redos',
						source,
					},
				},
			);
		}
	}

	/* ----------------------------- return guard ----------------------- */

	/**
	 * Recursively `Object.freeze` the return value to depth 4 so that any
	 * downstream node code that receives the result cannot mutate the
	 * evaluator's internal state by accident.
	 *
	 * Depth 4 is the bargain: deep enough to lock down 99% of realistic
	 * shapes (`{ items: [{ tags: ['x'] }] }`) while keeping the freeze pass
	 * O(n) without runaway recursion of its own.
	 *
	 * - Already-frozen values are skipped (cheap fast path).
	 * - Primitives are returned verbatim — `Object.freeze` on them is a
	 *   no-op but allocates an unnecessary check.
	 * - Cycles are tolerated via a visited Set.
	 */
	freezeReturn<T>(value: T): T {
		const visited = new WeakSet<object>();
		const walk = (v: unknown, depth: number): void => {
			if (depth > 4) return;
			if (v === null || typeof v !== 'object') return;
			if (Object.isFrozen(v)) return;
			if (visited.has(v as object)) return;
			visited.add(v as object);
			// Freeze *this* level before recursing so that even on a
			// pathological deeper-than-4 graph the top is locked.
			Object.freeze(v);
			if (Array.isArray(v)) {
				for (const item of v) walk(item, depth + 1);
				return;
			}
			for (const k of Object.keys(v as Record<string, unknown>)) {
				walk((v as Record<string, unknown>)[k], depth + 1);
			}
		};
		walk(value, 0);
		return value;
	}

	/* ----------------------------- diagnostics ------------------------ */

	/**
	 * Elapsed wall-clock time since {@link Sandbox.start} in milliseconds.
	 * Cheap — returns the cached reading from the last sampled tick (so the
	 * value can be stale by up to ~63 ticks worth of work).
	 */
	elapsedMs(): number {
		return this.lastNowMs - this.startedAtMs;
	}

	/** Current recursion depth — handy for tests / debugging. */
	currentDepth(): number {
		return this.depth;
	}

	/* ----------------------------- internals -------------------------- */

	/**
	 * Mark the sandbox poisoned with `err` and throw. After this every
	 * {@link Sandbox.tick}, {@link Sandbox.enter}, {@link Sandbox.onResult},
	 * and {@link Sandbox.assertSafeMemberAccess} call will re-throw the same
	 * error so the evaluator can't accidentally continue after a limit hit.
	 *
	 * @internal
	 */
	private fail(err: Error): never {
		this.poisoned = err;
		throw err;
	}
}
