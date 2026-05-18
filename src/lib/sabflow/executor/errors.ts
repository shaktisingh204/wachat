/**
 * SabFlow Executor — Error Taxonomy & Retry Semantics
 * ---------------------------------------------------
 *
 * Track B Phase 1 (sub-task #8): TypeScript-side error taxonomy for the
 * SabFlow Rust/Node executor. Mirrors n8n's `NodeApiError` /
 * `NodeOperationError` distinction so existing n8n workflow JSON can
 * round-trip through the SabFlow executor without losing error semantics.
 *
 * The Rust side (sibling sub-task #6) owns the wire-compatible Rust crate;
 * this module is the TypeScript dual of that wire format. Both sides agree
 * on a stable `code` string and the shape produced by {@link toWireError}.
 *
 * Design rules:
 * - Transient failures (5xx, 429, timeouts, transient pressure) are
 *   {@link ExecutorError.retryable | retryable}.
 * - User/programmer mistakes (`NodeOperationError`, `CredentialsError`,
 *   `WorkflowValidationError`) are NEVER retryable — retrying would just
 *   burn credits.
 * - {@link retryPolicy} respects `Retry-After` when the upstream API gave
 *   us one; otherwise exponential backoff with full jitter.
 *
 * @module sabflow/executor/errors
 */

/* ------------------------------------------------------------------ */
/* Wire format & shared types                                          */
/* ------------------------------------------------------------------ */

/**
 * Stable string codes that survive IPC between Node and the Rust
 * executor. Keep these stable — they are part of the public wire
 * contract and end up in audit logs.
 */
export type ExecutorErrorCode =
	| 'EXECUTOR_GENERIC'
	| 'NODE_API'
	| 'NODE_OPERATION'
	| 'EXPRESSION'
	| 'CREDENTIALS'
	| 'EXECUTION_TIMEOUT'
	| 'RESOURCE_LIMIT'
	| 'WORKFLOW_VALIDATION'
	| 'SUBWORKFLOW';

/**
 * The cause of a {@link ResourceLimitError}. `transient` (memory pressure,
 * burst concurrency cap) is retryable; `permanent` (plan-tier cap) is not.
 */
export type ResourceLimitKind = 'transient' | 'permanent';

/**
 * Serialized form of an {@link ExecutorError} — what the Rust crate emits
 * over IPC and what the Node side ships in API responses. Extra
 * subclass-specific fields are spread under `details`.
 */
export interface WireError {
	code: ExecutorErrorCode;
	message: string;
	retryable: boolean;
	httpStatus?: number;
	/** Node id this error fired from, when known. */
	nodeId?: string;
	/** Node-type name (e.g. "n8n-nodes-base.httpRequest"), when known. */
	nodeType?: string;
	/** Workflow id this error happened inside, when known. */
	workflowId?: string;
	/** Execution id, when known. */
	executionId?: string;
	/** Free-form subclass-specific structured data. */
	details?: Record<string, unknown>;
	/** Original error stack — omitted in production wire payloads. */
	stack?: string;
}

/** Options accepted by every {@link ExecutorError} constructor. */
export interface ExecutorErrorOptions {
	code?: ExecutorErrorCode;
	retryable?: boolean;
	httpStatus?: number;
	nodeId?: string;
	nodeType?: string;
	workflowId?: string;
	executionId?: string;
	cause?: unknown;
	details?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Base class                                                          */
/* ------------------------------------------------------------------ */

/**
 * Base class for every SabFlow executor error.
 *
 * Subclass this when you need a new error category — but only if the new
 * category needs its own retry semantics or its own `code`. Otherwise
 * prefer adding a `details` field to an existing class.
 *
 * @example
 * ```ts
 * try {
 *   await runNode(node, input);
 * } catch (cause) {
 *   throw new ExecutorError('runNode failed', {
 *     code: 'EXECUTOR_GENERIC',
 *     retryable: false,
 *     nodeId: node.id,
 *     cause,
 *   });
 * }
 * ```
 */
export class ExecutorError extends Error {
	public readonly code: ExecutorErrorCode;
	public readonly retryable: boolean;
	public readonly httpStatus?: number;
	public readonly nodeId?: string;
	public readonly nodeType?: string;
	public readonly workflowId?: string;
	public readonly executionId?: string;
	public readonly details?: Record<string, unknown>;

	constructor(message: string, opts: ExecutorErrorOptions = {}) {
		// Node's `Error` accepts a `cause` option (ES2022). Pass it through
		// so structured-stack chaining works in tooling.
		super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
		this.name = this.constructor.name;
		this.code = opts.code ?? 'EXECUTOR_GENERIC';
		this.retryable = opts.retryable ?? false;
		this.httpStatus = opts.httpStatus;
		this.nodeId = opts.nodeId;
		this.nodeType = opts.nodeType;
		this.workflowId = opts.workflowId;
		this.executionId = opts.executionId;
		this.details = opts.details;
		// V8 stack-trace hygiene.
		if (typeof (Error as unknown as { captureStackTrace?: Function }).captureStackTrace === 'function') {
			(Error as unknown as { captureStackTrace: (t: object, c: Function) => void }).captureStackTrace(
				this,
				this.constructor,
			);
		}
	}
}

/* ------------------------------------------------------------------ */
/* Subclasses                                                          */
/* ------------------------------------------------------------------ */

/** Options for {@link NodeApiError}. Carries upstream HTTP metadata. */
export interface NodeApiErrorOptions extends ExecutorErrorOptions {
	/** Upstream HTTP status code (e.g. 502, 429). */
	httpStatus?: number;
	/**
	 * `Retry-After` header value (seconds or HTTP-date). Honored by
	 * {@link retryPolicy}. Pass through verbatim from the API response.
	 */
	retryAfter?: string | number;
	/** Upstream URL for diagnostics — strip secrets before passing. */
	url?: string;
	/** Upstream method, when known. */
	method?: string;
}

/**
 * A 3rd-party API called by a node failed (the classic n8n
 * `NodeApiError`). HTTP-from-node-X errors land here.
 *
 * `retryable` is auto-derived from `httpStatus`: 5xx and 429 are
 * retryable, 4xx (other than 429) are not. Override `retryable` only when
 * you know better than the status code.
 *
 * @example
 * ```ts
 * const res = await fetch(url);
 * if (!res.ok) {
 *   throw new NodeApiError(`HTTP ${res.status} from upstream`, {
 *     httpStatus: res.status,
 *     retryAfter: res.headers.get('retry-after') ?? undefined,
 *     url, method: 'GET',
 *     nodeId: node.id, nodeType: node.type,
 *   });
 * }
 * ```
 */
export class NodeApiError extends ExecutorError {
	public readonly retryAfter?: string | number;
	public readonly url?: string;
	public readonly method?: string;

	constructor(message: string, opts: NodeApiErrorOptions = {}) {
		const status = opts.httpStatus;
		const autoRetryable =
			opts.retryable ??
			(typeof status === 'number' && (status >= 500 || status === 429 || status === 408));
		super(message, {
			...opts,
			code: 'NODE_API',
			retryable: autoRetryable,
			httpStatus: status,
		});
		this.retryAfter = opts.retryAfter;
		this.url = opts.url;
		this.method = opts.method;
	}
}

/** Options for {@link NodeOperationError}. */
export interface NodeOperationErrorOptions extends ExecutorErrorOptions {
	/** Optional pointer to the offending parameter / item. */
	itemIndex?: number;
	runIndex?: number;
}

/**
 * Bad params, schema violation, or other deterministic node-author /
 * end-user mistakes. NEVER retryable — running again won't fix the input.
 *
 * @example
 * ```ts
 * if (!params.url) {
 *   throw new NodeOperationError('Missing required parameter "url"', {
 *     nodeId: node.id, nodeType: node.type,
 *     details: { paramName: 'url' },
 *   });
 * }
 * ```
 */
export class NodeOperationError extends ExecutorError {
	public readonly itemIndex?: number;
	public readonly runIndex?: number;

	constructor(message: string, opts: NodeOperationErrorOptions = {}) {
		super(message, { ...opts, code: 'NODE_OPERATION', retryable: false });
		this.itemIndex = opts.itemIndex;
		this.runIndex = opts.runIndex;
	}
}

/** Options for {@link ExpressionError}. */
export interface ExpressionErrorOptions extends ExecutorErrorOptions {
	/** The original expression source, e.g. `{{ $json.foo }}`. */
	expression?: string;
	/** Column/offset within the expression, when the parser knows it. */
	position?: number;
}

/**
 * The expression engine failed — parse error, reference to a non-existent
 * variable, type mismatch, etc. NEVER retryable (deterministic on input).
 *
 * @example
 * ```ts
 * try {
 *   return engine.eval(expr, ctx);
 * } catch (cause) {
 *   throw new ExpressionError('Failed to evaluate expression', {
 *     expression: expr,
 *     nodeId: node.id, cause,
 *   });
 * }
 * ```
 */
export class ExpressionError extends ExecutorError {
	public readonly expression?: string;
	public readonly position?: number;

	constructor(message: string, opts: ExpressionErrorOptions = {}) {
		super(message, { ...opts, code: 'EXPRESSION', retryable: false });
		this.expression = opts.expression;
		this.position = opts.position;
	}
}

/** Options for {@link CredentialsError}. */
export interface CredentialsErrorOptions extends ExecutorErrorOptions {
	credentialId?: string;
	credentialType?: string;
	/** Why the creds are bad: not present, malformed, or token expired. */
	reason?: 'missing' | 'invalid' | 'expired';
}

/**
 * The credential store doesn't have what the node needs, or the creds it
 * has are invalid/expired. NEVER retryable — user must re-auth.
 *
 * @example
 * ```ts
 * const creds = await store.get(credentialId);
 * if (!creds) {
 *   throw new CredentialsError('Credentials not found', {
 *     credentialId, credentialType: 'googleSheetsOAuth2Api',
 *     reason: 'missing', nodeId: node.id,
 *   });
 * }
 * ```
 */
export class CredentialsError extends ExecutorError {
	public readonly credentialId?: string;
	public readonly credentialType?: string;
	public readonly reason?: 'missing' | 'invalid' | 'expired';

	constructor(message: string, opts: CredentialsErrorOptions = {}) {
		super(message, { ...opts, code: 'CREDENTIALS', retryable: false });
		this.credentialId = opts.credentialId;
		this.credentialType = opts.credentialType;
		this.reason = opts.reason;
	}
}

/** Options for {@link ExecutionTimeoutError}. */
export interface ExecutionTimeoutErrorOptions extends ExecutorErrorOptions {
	/** `workflow` for whole-workflow timeout, `node` for per-node. */
	scope?: 'workflow' | 'node';
	/** Configured timeout in ms (what was exceeded). */
	timeoutMs?: number;
	/** Elapsed time in ms when we gave up, if measured. */
	elapsedMs?: number;
}

/**
 * Workflow-level or node-level timeout exceeded. Retryable — the next
 * attempt may land on a less-loaded worker or a healthier upstream.
 *
 * @example
 * ```ts
 * throw new ExecutionTimeoutError('Node timed out after 30s', {
 *   scope: 'node', timeoutMs: 30_000, elapsedMs: 30_117,
 *   nodeId: node.id,
 * });
 * ```
 */
export class ExecutionTimeoutError extends ExecutorError {
	public readonly scope?: 'workflow' | 'node';
	public readonly timeoutMs?: number;
	public readonly elapsedMs?: number;

	constructor(message: string, opts: ExecutionTimeoutErrorOptions = {}) {
		super(message, {
			...opts,
			code: 'EXECUTION_TIMEOUT',
			retryable: opts.retryable ?? true,
		});
		this.scope = opts.scope;
		this.timeoutMs = opts.timeoutMs;
		this.elapsedMs = opts.elapsedMs;
	}
}

/** Options for {@link ResourceLimitError}. */
export interface ResourceLimitErrorOptions extends ExecutorErrorOptions {
	/** Which resource hit a cap. */
	resource?: 'memory' | 'cpu' | 'concurrency' | 'plan_quota';
	/** transient = back-off + retry will help; permanent = won't. */
	kind?: ResourceLimitKind;
	/** Numeric limit that was hit, when known. */
	limit?: number;
	/** Actual observed value at failure, when known. */
	observed?: number;
}

/**
 * Memory / CPU / concurrency / plan-quota cap exceeded.
 *
 * Retryable when `kind === 'transient'` (worker burst pressure, soft
 * concurrency cap). NOT retryable when `kind === 'permanent'` (plan-tier
 * cap — only an upgrade or quota reset fixes it).
 *
 * @example
 * ```ts
 * throw new ResourceLimitError('Worker memory pressure — shed load', {
 *   resource: 'memory', kind: 'transient',
 *   limit: 512 * 1024 * 1024, observed: 540 * 1024 * 1024,
 * });
 * ```
 */
export class ResourceLimitError extends ExecutorError {
	public readonly resource?: 'memory' | 'cpu' | 'concurrency' | 'plan_quota';
	public readonly kind?: ResourceLimitKind;
	public readonly limit?: number;
	public readonly observed?: number;

	constructor(message: string, opts: ResourceLimitErrorOptions = {}) {
		const autoRetryable = opts.retryable ?? opts.kind === 'transient';
		super(message, { ...opts, code: 'RESOURCE_LIMIT', retryable: autoRetryable });
		this.resource = opts.resource;
		this.kind = opts.kind;
		this.limit = opts.limit;
		this.observed = opts.observed;
	}
}

/** Options for {@link WorkflowValidationError}. */
export interface WorkflowValidationErrorOptions extends ExecutorErrorOptions {
	/** List of validation issues — keep stable across the wire. */
	issues?: Array<{ path?: string; message: string; nodeId?: string }>;
}

/**
 * The workflow IR / JSON failed pre-flight validation (missing nodes,
 * dangling edges, unknown node type, cyclic without loop node, etc).
 * NEVER retryable — the doc itself is wrong.
 *
 * @example
 * ```ts
 * throw new WorkflowValidationError('Workflow has dangling connections', {
 *   workflowId, issues: [
 *     { path: 'connections.HTTP.main[0]', message: 'target node missing' },
 *   ],
 * });
 * ```
 */
export class WorkflowValidationError extends ExecutorError {
	public readonly issues?: Array<{ path?: string; message: string; nodeId?: string }>;

	constructor(message: string, opts: WorkflowValidationErrorOptions = {}) {
		super(message, { ...opts, code: 'WORKFLOW_VALIDATION', retryable: false });
		this.issues = opts.issues;
	}
}

/** Options for {@link SubworkflowError}. */
export interface SubworkflowErrorOptions extends ExecutorErrorOptions {
	subWorkflowId?: string;
	subExecutionId?: string;
	/** The wrapped failure from the inner execution, when available. */
	innerError?: WireError;
}

/**
 * A sub-workflow execution failed. Wraps the inner error verbatim under
 * {@link SubworkflowErrorOptions.innerError | innerError} so callers can
 * decide retry semantics based on the inner cause.
 *
 * Retryability defers to the inner error: if `innerError.retryable` is
 * true we propagate that; otherwise default to false.
 *
 * @example
 * ```ts
 * try {
 *   await runSubWorkflow(subId, payload);
 * } catch (inner) {
 *   const wire = toWireError(inner);
 *   throw new SubworkflowError('Sub-workflow failed', {
 *     subWorkflowId: subId,
 *     subExecutionId: subExec.id,
 *     innerError: wire,
 *     retryable: wire.retryable,
 *     cause: inner,
 *   });
 * }
 * ```
 */
export class SubworkflowError extends ExecutorError {
	public readonly subWorkflowId?: string;
	public readonly subExecutionId?: string;
	public readonly innerError?: WireError;

	constructor(message: string, opts: SubworkflowErrorOptions = {}) {
		super(message, {
			...opts,
			code: 'SUBWORKFLOW',
			retryable: opts.retryable ?? opts.innerError?.retryable ?? false,
		});
		this.subWorkflowId = opts.subWorkflowId;
		this.subExecutionId = opts.subExecutionId;
		this.innerError = opts.innerError;
	}
}

/* ------------------------------------------------------------------ */
/* Retry decisions                                                     */
/* ------------------------------------------------------------------ */

/**
 * Returns true for **transient** errors only.
 *
 * Rules:
 * - `NodeApiError` → true when HTTP status is 5xx, 408, or 429.
 * - `ExecutionTimeoutError` → always true.
 * - `ResourceLimitError` → true iff `kind === 'transient'`.
 * - `SubworkflowError` → defers to the wrapped inner error.
 * - `NodeOperationError`, `CredentialsError`, `WorkflowValidationError`,
 *   `ExpressionError` → always false.
 * - Anything else (incl. plain `Error`) → false (fail-closed).
 *
 * @example
 * ```ts
 * try { await callNode(); }
 * catch (e) {
 *   if (isRetryable(e)) await scheduleRetry(e);
 *   else await markDeadLetter(e);
 * }
 * ```
 */
export function isRetryable(err: unknown): boolean {
	if (!(err instanceof ExecutorError)) return false;

	if (err instanceof NodeOperationError) return false;
	if (err instanceof CredentialsError) return false;
	if (err instanceof WorkflowValidationError) return false;
	if (err instanceof ExpressionError) return false;

	if (err instanceof NodeApiError) {
		const s = err.httpStatus;
		return typeof s === 'number' && (s >= 500 || s === 429 || s === 408);
	}
	if (err instanceof ExecutionTimeoutError) return true;
	if (err instanceof ResourceLimitError) return err.kind === 'transient';
	if (err instanceof SubworkflowError) return err.innerError?.retryable ?? false;

	return err.retryable;
}

/**
 * Retry policy resolved from an error. The dispatcher consults this to
 * decide *how many* attempts and *how long* to wait between them.
 *
 * - 5xx / 429 from a node API: exponential backoff with **full jitter**
 *   ([AWS arch blog formula](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)).
 * - `Retry-After` (when present on a {@link NodeApiError}) overrides the
 *   computed backoff for the *next* attempt (still capped, still jittered
 *   downward by up to 10% to avoid thundering herd).
 * - `ExecutionTimeoutError` / transient `ResourceLimitError`: same
 *   exponential backoff but starts at a longer base (2s) since the cause
 *   is usually pressure, not a flaky upstream.
 * - Non-retryable errors: `tries: 0`, backoff returns `0`.
 */
export interface RetryPolicy {
	/** Maximum number of additional attempts (does not count the first). */
	tries: number;
	/** Returns the wait in milliseconds before attempt `attempt` (1-indexed). */
	backoffMs: (attempt: number) => number;
}

/** Default knobs for {@link retryPolicy}. */
const DEFAULTS = {
	apiBaseMs: 500,
	apiMaxMs: 30_000,
	apiTries: 5,
	pressureBaseMs: 2_000,
	pressureMaxMs: 60_000,
	pressureTries: 3,
} as const;

/**
 * Parse a `Retry-After` value into milliseconds.
 *
 * Accepts:
 * - a number (seconds),
 * - a numeric string (seconds),
 * - an HTTP-date string.
 *
 * Returns `undefined` when the value is missing or unparseable.
 *
 * @internal
 */
function parseRetryAfterMs(value: string | number | undefined): number | undefined {
	if (value === undefined || value === null) return undefined;
	if (typeof value === 'number') {
		return Number.isFinite(value) && value >= 0 ? value * 1000 : undefined;
	}
	const asNum = Number(value);
	if (Number.isFinite(asNum) && asNum >= 0) return asNum * 1000;
	const asDate = Date.parse(value);
	if (!Number.isNaN(asDate)) {
		const delta = asDate - Date.now();
		return delta > 0 ? delta : 0;
	}
	return undefined;
}

/**
 * Full-jitter exponential backoff: `random_between(0, min(cap, base*2^n))`.
 * Per the AWS architecture-blog recommendation, this gives the best
 * thundering-herd avoidance vs. equal-jitter for our scale.
 *
 * @internal
 */
function fullJitter(baseMs: number, maxMs: number, attempt: number): number {
	const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
	return Math.floor(Math.random() * exp);
}

/**
 * Build a {@link RetryPolicy} for the given error.
 *
 * @example
 * ```ts
 * const policy = retryPolicy(err);
 * for (let attempt = 1; attempt <= policy.tries; attempt++) {
 *   await sleep(policy.backoffMs(attempt));
 *   try { return await call(); }
 *   catch (e) { if (!isRetryable(e)) throw e; }
 * }
 * throw err;
 * ```
 */
export function retryPolicy(err: unknown): RetryPolicy {
	if (!isRetryable(err)) {
		return { tries: 0, backoffMs: () => 0 };
	}

	if (err instanceof NodeApiError) {
		const headerMs = parseRetryAfterMs(err.retryAfter);
		return {
			tries: DEFAULTS.apiTries,
			backoffMs: (attempt: number) => {
				if (attempt === 1 && headerMs !== undefined) {
					// Honor Retry-After but jitter down ~10% so coordinated
					// 429s don't all retry on the same millisecond.
					const jitter = Math.floor(Math.random() * (headerMs * 0.1));
					return Math.max(0, headerMs - jitter);
				}
				return fullJitter(DEFAULTS.apiBaseMs, DEFAULTS.apiMaxMs, attempt);
			},
		};
	}

	if (err instanceof ExecutionTimeoutError || err instanceof ResourceLimitError) {
		return {
			tries: DEFAULTS.pressureTries,
			backoffMs: (attempt: number) =>
				fullJitter(DEFAULTS.pressureBaseMs, DEFAULTS.pressureMaxMs, attempt),
		};
	}

	if (err instanceof SubworkflowError && err.innerError?.retryable) {
		// Sub-workflow retries are coarse — one extra attempt with a long,
		// jittered base so we don't hammer the inner workflow.
		return {
			tries: 1,
			backoffMs: () => fullJitter(DEFAULTS.pressureBaseMs, DEFAULTS.pressureMaxMs, 2),
		};
	}

	// Generic retryable ExecutorError fallback.
	return {
		tries: DEFAULTS.apiTries,
		backoffMs: (attempt: number) => fullJitter(DEFAULTS.apiBaseMs, DEFAULTS.apiMaxMs, attempt),
	};
}

/* ------------------------------------------------------------------ */
/* Serialization                                                       */
/* ------------------------------------------------------------------ */

/**
 * Serialize *any* error into the {@link WireError} shape for IPC between
 * Node and the Rust executor (and for API responses).
 *
 * Unknown errors get mapped to `code: 'EXECUTOR_GENERIC'`, `retryable:
 * false`. Stack is omitted unless `includeStack` is true.
 *
 * Subclass-specific fields are folded into `details` so the Rust side can
 * round-trip them as a typed enum payload without losing data.
 *
 * @example
 * ```ts
 * try { await run(); }
 * catch (e) {
 *   res.status(500).json({ error: toWireError(e) });
 * }
 * ```
 */
export function toWireError(err: unknown, opts: { includeStack?: boolean } = {}): WireError {
	if (err instanceof ExecutorError) {
		const base: WireError = {
			code: err.code,
			message: err.message,
			retryable: err.retryable,
			httpStatus: err.httpStatus,
			nodeId: err.nodeId,
			nodeType: err.nodeType,
			workflowId: err.workflowId,
			executionId: err.executionId,
			details: { ...(err.details ?? {}) },
		};
		if (opts.includeStack && err.stack) base.stack = err.stack;

		if (err instanceof NodeApiError) {
			Object.assign(base.details!, {
				retryAfter: err.retryAfter,
				url: err.url,
				method: err.method,
			});
		} else if (err instanceof NodeOperationError) {
			Object.assign(base.details!, {
				itemIndex: err.itemIndex,
				runIndex: err.runIndex,
			});
		} else if (err instanceof ExpressionError) {
			Object.assign(base.details!, {
				expression: err.expression,
				position: err.position,
			});
		} else if (err instanceof CredentialsError) {
			Object.assign(base.details!, {
				credentialId: err.credentialId,
				credentialType: err.credentialType,
				reason: err.reason,
			});
		} else if (err instanceof ExecutionTimeoutError) {
			Object.assign(base.details!, {
				scope: err.scope,
				timeoutMs: err.timeoutMs,
				elapsedMs: err.elapsedMs,
			});
		} else if (err instanceof ResourceLimitError) {
			Object.assign(base.details!, {
				resource: err.resource,
				kind: err.kind,
				limit: err.limit,
				observed: err.observed,
			});
		} else if (err instanceof WorkflowValidationError) {
			Object.assign(base.details!, { issues: err.issues });
		} else if (err instanceof SubworkflowError) {
			Object.assign(base.details!, {
				subWorkflowId: err.subWorkflowId,
				subExecutionId: err.subExecutionId,
				innerError: err.innerError,
			});
		}

		// Strip undefined keys so the wire payload is tidy.
		if (base.details) {
			for (const k of Object.keys(base.details)) {
				if (base.details[k] === undefined) delete base.details[k];
			}
			if (Object.keys(base.details).length === 0) delete base.details;
		}
		return base;
	}

	if (err instanceof Error) {
		return {
			code: 'EXECUTOR_GENERIC',
			message: err.message,
			retryable: false,
			...(opts.includeStack && err.stack ? { stack: err.stack } : {}),
		};
	}

	return {
		code: 'EXECUTOR_GENERIC',
		message: typeof err === 'string' ? err : 'Unknown executor error',
		retryable: false,
	};
}

/**
 * Reconstruct an {@link ExecutorError} subclass from a {@link WireError}.
 * Useful on the Node side when the Rust executor reports a failure over
 * IPC and we want to throw a real typed error.
 *
 * @example
 * ```ts
 * const wire: WireError = await rpc.call('runNode', payload);
 * if (wire) throw fromWireError(wire);
 * ```
 */
export function fromWireError(wire: WireError): ExecutorError {
	const common: ExecutorErrorOptions = {
		code: wire.code,
		retryable: wire.retryable,
		httpStatus: wire.httpStatus,
		nodeId: wire.nodeId,
		nodeType: wire.nodeType,
		workflowId: wire.workflowId,
		executionId: wire.executionId,
		details: wire.details,
	};
	const d = wire.details ?? {};
	switch (wire.code) {
		case 'NODE_API':
			return new NodeApiError(wire.message, {
				...common,
				retryAfter: d.retryAfter as string | number | undefined,
				url: d.url as string | undefined,
				method: d.method as string | undefined,
			});
		case 'NODE_OPERATION':
			return new NodeOperationError(wire.message, {
				...common,
				itemIndex: d.itemIndex as number | undefined,
				runIndex: d.runIndex as number | undefined,
			});
		case 'EXPRESSION':
			return new ExpressionError(wire.message, {
				...common,
				expression: d.expression as string | undefined,
				position: d.position as number | undefined,
			});
		case 'CREDENTIALS':
			return new CredentialsError(wire.message, {
				...common,
				credentialId: d.credentialId as string | undefined,
				credentialType: d.credentialType as string | undefined,
				reason: d.reason as 'missing' | 'invalid' | 'expired' | undefined,
			});
		case 'EXECUTION_TIMEOUT':
			return new ExecutionTimeoutError(wire.message, {
				...common,
				scope: d.scope as 'workflow' | 'node' | undefined,
				timeoutMs: d.timeoutMs as number | undefined,
				elapsedMs: d.elapsedMs as number | undefined,
			});
		case 'RESOURCE_LIMIT':
			return new ResourceLimitError(wire.message, {
				...common,
				resource: d.resource as ResourceLimitErrorOptions['resource'],
				kind: d.kind as ResourceLimitKind | undefined,
				limit: d.limit as number | undefined,
				observed: d.observed as number | undefined,
			});
		case 'WORKFLOW_VALIDATION':
			return new WorkflowValidationError(wire.message, {
				...common,
				issues: d.issues as WorkflowValidationErrorOptions['issues'],
			});
		case 'SUBWORKFLOW':
			return new SubworkflowError(wire.message, {
				...common,
				subWorkflowId: d.subWorkflowId as string | undefined,
				subExecutionId: d.subExecutionId as string | undefined,
				innerError: d.innerError as WireError | undefined,
			});
		case 'EXECUTOR_GENERIC':
		default:
			return new ExecutorError(wire.message, common);
	}
}
