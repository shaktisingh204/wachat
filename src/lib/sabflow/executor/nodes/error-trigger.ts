/**
 * SabFlow Executor — ErrorTrigger + Catch nodes
 * ----------------------------------------------
 *
 * Track B Phase 3 (sub-task #10 of 10): error-handling entry points for
 * workflows. Two complementary node types live here because both are tied
 * to the executor's error pipeline and share the same payload shape:
 *
 *  1. `SabFlow.ErrorTrigger` — entry node for an "error workflow". When a
 *     primary workflow fails and that workflow has `errorWorkflowId` set,
 *     the dispatcher fires this trigger with a synthesised failure payload
 *     so users can route alerts (email, Slack, Sentry) without touching
 *     the failed workflow itself. n8n parity: `n8n-nodes-base.errorTrigger`.
 *
 *  2. `SabFlow.Catch` — inline error trap inside the same workflow. Wraps
 *     a referenced upstream node (or group of nodes) in a try/catch
 *     envelope at dispatch time. Has two output ports:
 *       - port 0: items carrying `json.error` (the caught failure).
 *       - port 1: pass-through normal items (when no upstream error fired).
 *     n8n parity: roughly the "On Error → Continue (using error output)"
 *     setting hoisted into a real node so users can branch on it.
 *
 * The `execute()` body for `SabFlow.Catch` here only handles the
 * pass-through case. The interesting bit (installing the try/catch around
 * upstream nodes) is the executor's job — see the forward-declared
 * {@link CatchEnvelopeInstaller} below; the dispatcher reads parameters
 * straight off the IR node and wires `NodeError` items onto port 0
 * itself. This keeps the node implementation tiny and side-effect-free.
 *
 * Cross-file contract (forward declarations only; no imports needed):
 *  - The dispatcher inspects `parameters.catchScope` + `parameters.nodeIds`
 *    on `SabFlow.Catch` nodes before scheduling and rewrites edges so the
 *    referenced upstream nodes run inside a try/catch. On catch it emits
 *    `{ json: { error, item? }, pairedItem? }` onto port 0.
 *  - The dispatcher looks up `workflow.errorWorkflowId` on failure of any
 *    primary workflow and, if set, kicks off the target with a single item
 *    shaped by {@link formatErrorPayload}. The receiving workflow's first
 *    node must be a `SabFlow.ErrorTrigger`.
 *
 * @module sabflow/executor/nodes/error-trigger
 */

import type {
	NodeError,
	NodeExecutionContext,
	NodeExecutionItem,
	NodeExecutionResult,
	NodeRegistration,
} from '../contract';

/* ------------------------------------------------------------------ */
/* Forward declarations of engine internals                            */
/* ------------------------------------------------------------------ */

/**
 * Shape of the "error workflow kick-off" payload the dispatcher hands to
 * an `ErrorTrigger` node when it fires a registered error workflow.
 *
 * This is intentionally redeclared (not imported) so the node file stays
 * standalone — the dispatcher constructs the same shape on its side via
 * {@link formatErrorPayload}.
 */
export interface ErrorTriggerPayload {
	execution: {
		id: string;
		workflowId: string;
		mode: 'manual' | 'trigger' | 'webhook' | 'retry' | 'integrated';
		startedAt: string; // ISO-8601
		stoppedAt: string; // ISO-8601
	};
	error: {
		message: string;
		stack?: string;
		/** Node id where the failure originated, when known. */
		node?: string;
		/** Last node name that completed successfully before the failure. */
		lastNodeExecuted?: string;
		/** Stable executor error code (`NODE_API`, `CREDENTIALS`, etc.). */
		code?: string;
		/** Upstream HTTP status when applicable. */
		httpStatus?: number;
	};
	workflow: {
		id: string;
		name: string;
	};
	/** Original execution id when this is a retry. */
	retryOf?: string;
}

/**
 * Forward-declared installer contract used by the dispatcher. The
 * dispatcher constructs one of these per `SabFlow.Catch` node before
 * scheduling, then wraps the referenced upstream nodes' executors in a
 * try/catch that emits caught errors onto the Catch node's port 0.
 *
 * Declared here for documentation only — the actual implementation lives
 * in the executor's edge-rewriter and is wired up at run-init time.
 */
export interface CatchEnvelopeInstaller {
	(opts: {
		catchNodeId: string;
		scope: CatchScope;
		nodeIds: string[];
	}): void;
}

/** Parameter values for `SabFlow.Catch.catchScope`. */
export type CatchScope = 'node' | 'group';

/* ------------------------------------------------------------------ */
/* Payload shaping helper                                              */
/* ------------------------------------------------------------------ */

/**
 * Shape a {@link NodeError} (or any thrown value) into the canonical
 * {@link ErrorTriggerPayload} consumed by an `ErrorTrigger` entry node.
 *
 * The dispatcher calls this when it decides to kick off an error
 * workflow; this file re-exports it so tests and integration code can
 * synthesise the same payload without reaching into executor internals.
 *
 * Rules:
 *  - `message`/`stack`/`node`/`code`/`httpStatus` are read from the
 *    `NodeError` when present, with safe fallbacks for plain `Error` /
 *    string throws.
 *  - `startedAt` defaults to the wall-clock now when the caller does not
 *    supply it; `stoppedAt` defaults to the same instant. Both are ISO.
 *  - Output is plain JSON (no class instances, no functions) so it can
 *    cross the Node↔Rust IPC boundary verbatim.
 *
 * @param err          The failure that triggered the error workflow.
 * @param executionId  The execution id of the *failed primary* workflow.
 * @param workflowId   The workflow id of the *failed primary* workflow.
 * @param meta         Optional extra metadata the dispatcher knows about.
 */
export function formatErrorPayload(
	err: NodeError | Error | unknown,
	executionId: string,
	workflowId: string,
	meta: {
		workflowName?: string;
		mode?: ErrorTriggerPayload['execution']['mode'];
		startedAt?: string | Date;
		stoppedAt?: string | Date;
		lastNodeExecuted?: string;
		retryOf?: string;
	} = {},
): ErrorTriggerPayload {
	const startedAt = toIso(meta.startedAt) ?? new Date().toISOString();
	const stoppedAt = toIso(meta.stoppedAt) ?? startedAt;

	let message = 'Unknown executor error';
	let stack: string | undefined;
	let node: string | undefined;
	let code: string | undefined;
	let httpStatus: number | undefined;

	if (isNodeError(err)) {
		message = err.message;
		stack = err.stack;
		// `NodeError` from contract.ts is a flat envelope; the dispatcher
		// stashes the originating node id on `context.nodeId` if it knew it.
		const ctx = err.context;
		if (ctx && typeof ctx === 'object') {
			const maybeNode = (ctx as Record<string, unknown>).nodeId;
			if (typeof maybeNode === 'string') node = maybeNode;
		}
		code = err.code;
		httpStatus = err.httpStatus;
	} else if (err instanceof Error) {
		message = err.message || message;
		stack = err.stack;
	} else if (typeof err === 'string') {
		message = err;
	}

	const out: ErrorTriggerPayload = {
		execution: {
			id: executionId,
			workflowId,
			mode: meta.mode ?? 'trigger',
			startedAt,
			stoppedAt,
		},
		error: {
			message,
			...(stack !== undefined ? { stack } : {}),
			...(node !== undefined ? { node } : {}),
			...(meta.lastNodeExecuted !== undefined
				? { lastNodeExecuted: meta.lastNodeExecuted }
				: {}),
			...(code !== undefined ? { code } : {}),
			...(httpStatus !== undefined ? { httpStatus } : {}),
		},
		workflow: {
			id: workflowId,
			name: meta.workflowName ?? '',
		},
		...(meta.retryOf !== undefined ? { retryOf: meta.retryOf } : {}),
	};
	return out;
}

function toIso(value: string | Date | undefined): string | undefined {
	if (value === undefined) return undefined;
	if (value instanceof Date) return value.toISOString();
	// Trust caller-supplied strings — they came from the dispatcher.
	return value;
}

function isNodeError(value: unknown): value is NodeError {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	return typeof v.code === 'string' && typeof v.message === 'string';
}

/* ------------------------------------------------------------------ */
/* SabFlow.ErrorTrigger                                                */
/* ------------------------------------------------------------------ */

/**
 * Entry-point trigger for an "error workflow".
 *
 * At runtime the dispatcher injects the synthesised payload via
 * `ctx.getNodeParameter('__payload', 0)` (a reserved parameter name the
 * editor never exposes). When no payload is injected (e.g. the user hits
 * "Execute node" from the editor to test their alert wiring), we emit a
 * minimal stub so downstream nodes still receive a well-shaped item.
 */
export const ErrorTriggerNode: NodeRegistration = {
	type: 'SabFlow.ErrorTrigger',
	typeVersion: 1,
	description:
		'Fires when the workflow this is configured as an error handler for fails. Receives the failed execution + error metadata.',
	defaults: {
		name: 'On Error',
		color: '#E2393B',
	},
	properties: [
		// No user-editable parameters: payload is dispatcher-injected.
		// Keeping the array non-empty (a single read-only notice) helps the
		// property panel render an explanatory blurb in the editor.
		{
			displayName: 'Notice',
			name: 'notice',
			type: 'string',
			default:
				'This trigger fires automatically when the linked workflow fails. Wire it to email, Slack, or any other alert node.',
			description: 'Read-only explanation surfaced in the editor.',
			noDataExpression: true,
		},
	],
	execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
		// The dispatcher tucks the synthesised payload onto the reserved
		// `__payload` parameter slot. When absent (manual test from the
		// editor) we emit a stub so downstream nodes can still be wired.
		const injected = ctx.getNodeParameter<ErrorTriggerPayload | undefined>(
			'__payload',
			0,
			undefined,
		);
		const payload: ErrorTriggerPayload =
			injected ?? {
				execution: {
					id: 'manual-test',
					workflowId: 'manual-test',
					mode: 'manual',
					startedAt: new Date().toISOString(),
					stoppedAt: new Date().toISOString(),
				},
				error: {
					message: 'Manual trigger test — no real error attached.',
				},
				workflow: {
					id: 'manual-test',
					name: '',
				},
			};

		const item: NodeExecutionItem = { json: payload as unknown as Record<string, unknown> };
		return { output: [[item]] };
	},
};

/* ------------------------------------------------------------------ */
/* SabFlow.Catch                                                       */
/* ------------------------------------------------------------------ */

/**
 * Inline error trap. Marker node — most of the heavy lifting is done by
 * the executor's edge-rewriter (see {@link CatchEnvelopeInstaller}).
 *
 * Ports:
 *  - 0: caught error path. Items here are emitted by the executor's
 *       try/catch envelope around the referenced upstream node(s); each
 *       item carries `json.error` shaped like
 *       `{ message, code?, httpStatus?, node?, stack? }` plus the
 *       original item under `json.item` when one was in flight.
 *  - 1: pass-through normal path. Forwarded inputs from the upstream
 *       chain that did *not* error.
 *
 * The body below handles only port 1. Caught-error items reach port 0
 * via dispatcher-installed envelopes; the dispatcher does not call
 * `execute()` for those items at all (they short-circuit the marker).
 */
export const CatchNode: NodeRegistration = {
	type: 'SabFlow.Catch',
	typeVersion: 1,
	description:
		'Catch errors from one or more upstream nodes. Output 0 = caught error path, output 1 = pass-through.',
	defaults: {
		name: 'Catch',
		color: '#F4B400',
	},
	properties: [
		{
			displayName: 'Catch Scope',
			name: 'catchScope',
			type: 'options',
			default: 'node',
			description:
				'Whether to catch errors from a specific upstream node, or from every node in a connected group.',
			options: [
				{ name: 'Specific Node(s)', value: 'node' },
				{ name: 'Connected Group', value: 'group' },
			],
			noDataExpression: true,
		},
		{
			displayName: 'Upstream Node IDs',
			name: 'nodeIds',
			type: 'json',
			default: '[]',
			description:
				'JSON array of upstream node ids to trap. Used when Catch Scope = Specific Node(s). The executor installs try/catch envelopes around these nodes at dispatch time.',
			noDataExpression: true,
		},
	],
	execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
		// Forward all input items to port 1 (the "no upstream error"
		// pass-through). Port 0 is reserved for dispatcher-emitted
		// caught-error items and is left empty here.
		const items = ctx.getInputData(0);
		return { output: [[], items] };
	},
};

/* ------------------------------------------------------------------ */
/* Registry export                                                     */
/* ------------------------------------------------------------------ */

/**
 * Convenience bundle so the executor's node registry can pull both
 * registrations from a single import.
 */
export const errorHandlingNodes: NodeRegistration[] = [ErrorTriggerNode, CatchNode];
