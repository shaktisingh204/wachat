/**
 * SabFlow `Wait` node (n8n-parity, typeVersion 1)
 * -----------------------------------------------
 *
 * Track B Phase 3 (sub-task #7 of 10).
 *
 * The Wait node pauses workflow execution until one of four resume
 * conditions is satisfied. Unlike most nodes, it does NOT compute a
 * synchronous output during {@link WaitNode.execute}: instead it throws
 * a {@link WaitResumeSignal} that the executor (sibling Track B Phase 7)
 * recognises via `instanceof` and uses to park the execution in Mongo
 * with `status: 'waiting'` (see `../state.ts` → `ExecutionStatus`).
 *
 * Four wait modes are supported, mirroring n8n's `n8n-nodes-base.wait`:
 *
 *  1. `timeInterval` — wait a relative duration (e.g. "5 minutes").
 *     {@link computeResumeAt} converts the (amount, unit) pair into an
 *     absolute `resumeAt` `Date`; the signal carries that date and the
 *     dispatcher's wake-up timer reclaims the execution when due.
 *
 *  2. `dateTime` — wait until a specific absolute timestamp.
 *
 *  3. `webhook` — pause until an inbound HTTP request hits
 *     `/wait/<executionId>/<nodeId>/<token>` (the public resume URL the
 *     executor mints). The webhook body is fed back in by the dispatcher
 *     and surfaces as the node's output on resume.
 *
 *  4. `formSubmit` — pause until the user submits a generated form. The
 *     form itself is rendered by Phase 6 sub-task #1; on this side we
 *     just emit the same `webhook`-shaped resume signal with a distinct
 *     `resumeKind` so the renderer knows to attach the form UI.
 *
 * Two seams cross this file:
 *
 *  - {@link WaitResumeSignal} is `export`ed as a class so the executor
 *    (Phase 7) can `instanceof WaitResumeSignal` and branch into its
 *    "park execution" plumbing. It deliberately does NOT extend `Error`'s
 *    `NodeOperationError` chain — a Wait is not a failure, it is a
 *    cooperative yield, and the executor must not surface it on the
 *    error port or count it against retry budgets.
 *
 *  - {@link computeResumeAt} is exported separately so the dispatcher's
 *    "what's the soonest waiting execution we have to wake?" sweeper can
 *    pre-compute resume timestamps from raw IR `parameters` without
 *    constructing a context. It is pure / deterministic given a `now`.
 *
 * Constraints honoured (per the sub-task spec):
 *  - This file does NOT park the execution; that is Phase B.7's job.
 *  - This file does NOT render the wait form; that is Phase 6 #1's job.
 *  - This file owns the `SabFlow.Wait` registration AND the
 *    {@link WaitResumeSignal} class AND the {@link computeResumeAt}
 *    helper, and nothing else.
 *
 * @module sabflow/executor/nodes/wait
 */

import type {
	NodeExecutionContext,
	NodeExecutionItem,
	NodeExecutionResult,
	NodeRegistration,
} from '../contract';

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

/**
 * Wait modes supported by `SabFlow.Wait`. Stable wire identifiers — the
 * Rust IR mirrors these strings, so do not rename without bumping
 * `typeVersion`.
 */
export type WaitMode = 'timeInterval' | 'dateTime' | 'webhook' | 'formSubmit';

/**
 * Time units accepted by the `timeInterval` mode. Mirrors n8n's
 * `n8n-nodes-base.wait.unit` option set verbatim.
 */
export type WaitTimeUnit = 'seconds' | 'minutes' | 'hours' | 'days';

/**
 * Subset of the IR parameter bag relevant to {@link computeResumeAt}.
 *
 * Declared as its own type so the dispatcher's "wake the next waiting
 * execution" sweeper can pre-compute resume timestamps from a raw
 * `parameters: Record<string, unknown>` map without constructing a
 * full execution context.
 */
export interface WaitNodeParams {
	/** Active wait mode. */
	mode: WaitMode;
	/** `timeInterval`: amount of units to wait. */
	amount?: number;
	/** `timeInterval`: unit for `amount`. */
	unit?: WaitTimeUnit;
	/** `dateTime`: absolute ISO-8601 timestamp (or `Date`). */
	dateTime?: string | Date;
	/**
	 * `webhook` / `formSubmit`: optional ceiling on how long the executor
	 * will hold the execution open before timing out. Mirrors n8n's
	 * "Limit Wait Time" option. Defaults to "no ceiling" (undefined).
	 */
	resumeTimeout?: { amount: number; unit: WaitTimeUnit };
}

/**
 * Shape of the parked-execution descriptor carried by a
 * {@link WaitResumeSignal}. The executor (Phase 7) persists this verbatim
 * into the execution doc's parked-state field; the resume webhook handler
 * + sweeper read it back to decide how to wake the run.
 */
export interface WaitResumeDescriptor {
	/** Which mode is responsible for resuming this wait. */
	resumeKind: WaitMode;
	/**
	 * Absolute wall-clock time the execution should resume at.
	 *  - `timeInterval` / `dateTime`: required.
	 *  - `webhook` / `formSubmit`: optional ceiling (see `resumeTimeout`
	 *    on {@link WaitNodeParams}). When set, the dispatcher will time
	 *    out the wait and fail the execution if no resume request arrives
	 *    by this instant.
	 */
	resumeAt?: Date;
	/**
	 * Node id this wait is parked on. The executor stamps this on the
	 * signal; the resume webhook URL embeds it so we can route the
	 * inbound body back to the correct node.
	 */
	nodeId: string;
	/**
	 * Cryptographically-random token the executor mints when minting the
	 * resume URL. The webhook handler validates that the inbound request
	 * carries the same token before resuming, so a leaked execution id
	 * is not enough to wake a wait.
	 */
	resumeToken?: string;
}

/* ------------------------------------------------------------------ */
/* WaitResumeSignal                                                    */
/* ------------------------------------------------------------------ */

/**
 * Cooperative "yield" signal thrown by {@link WaitNode.execute} when the
 * node decides to park the execution.
 *
 * The executor (Track B Phase 7) MUST catch this with an `instanceof
 * WaitResumeSignal` check and:
 *  1. Persist {@link WaitResumeSignal.descriptor} onto the execution doc.
 *  2. Flip the doc's `status` from `running` → `waiting` (see
 *     `../state.ts → ExecutionStatus`).
 *  3. Stamp `resumeAt` on the doc for the dispatcher sweeper.
 *  4. Release the worker slot.
 *
 * It deliberately does NOT extend `NodeOperationError` (or any of the
 * executor's error classes) — a Wait is a cooperative yield, not a
 * failure. Retry policy, error workflow kick-off, and `continueOnFail`
 * must all be bypassed for this signal type.
 *
 * Extending the built-in `Error` is a pragmatic concession to JS's lack
 * of dedicated control-flow types: `throw` is the only mechanism that
 * cleanly unwinds nested awaits in n8n-style node code, so we ride that
 * mechanism with a class the executor can reliably discriminate.
 */
export class WaitResumeSignal extends Error {
	/** Stable discriminator tag — useful when `instanceof` is stripped (e.g. cross-realm IPC). */
	public readonly kind = 'sabflow.wait.resume' as const;

	/** Parked-execution descriptor. The executor persists this verbatim. */
	public readonly descriptor: WaitResumeDescriptor;

	/**
	 * Items the node was holding when it parked. Forwarded to the
	 * resumed node run so the executor can re-deliver the same items to
	 * downstream ports once the wait resolves. n8n stores these on the
	 * parked execution doc under `data.waiting`; we mirror that here so
	 * the executor's Phase 7 plumbing has somewhere to read them from.
	 */
	public readonly heldItems: NodeExecutionItem[];

	constructor(descriptor: WaitResumeDescriptor, heldItems: NodeExecutionItem[] = []) {
		super(`SabFlow.Wait parked execution on node "${descriptor.nodeId}"`);
		this.name = 'WaitResumeSignal';
		this.descriptor = descriptor;
		this.heldItems = heldItems;
		// Maintain a clean prototype chain so `instanceof WaitResumeSignal`
		// works across transpilation targets that down-level `extends Error`.
		Object.setPrototypeOf(this, new.target.prototype);
	}
}

/**
 * Type guard a non-executor consumer (tests, the Phase 7 dispatcher) can
 * call when `instanceof` is unavailable — for example when the signal
 * crossed a worker-thread / structured-clone boundary that stripped the
 * class identity.
 */
export function isWaitResumeSignal(value: unknown): value is WaitResumeSignal {
	if (!value || typeof value !== 'object') return false;
	const v = value as { kind?: unknown; descriptor?: unknown };
	return (
		v.kind === 'sabflow.wait.resume' &&
		typeof v.descriptor === 'object' &&
		v.descriptor !== null
	);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Convert an `(amount, unit)` pair to milliseconds. Internal helper for
 * {@link computeResumeAt}. Negative amounts collapse to `0` so a
 * misconfigured node never parks indefinitely in the past.
 *
 * @internal
 */
function intervalToMs(amount: number, unit: WaitTimeUnit): number {
	const a = Number.isFinite(amount) && amount > 0 ? amount : 0;
	switch (unit) {
		case 'seconds':
			return a * MS_PER_SECOND;
		case 'minutes':
			return a * MS_PER_MINUTE;
		case 'hours':
			return a * MS_PER_HOUR;
		case 'days':
			return a * MS_PER_DAY;
		default: {
			// Exhaustiveness sentinel — surface unknown units as zero so the
			// executor parks the wait but the wake-up sweeper fires nearly
			// immediately. Better than throwing here, because this helper is
			// called from the dispatcher's pre-compute path on cold IR JSON
			// that may have been written by an older client.
			const _exhaust: never = unit;
			void _exhaust;
			return 0;
		}
	}
}

/**
 * Compute the absolute `Date` an execution should resume at given the
 * node's {@link WaitNodeParams} and a `now` reference time.
 *
 * Exported because the dispatcher's "wake the next waiting execution"
 * sweeper (Phase 7) pre-computes resume timestamps from raw IR
 * `parameters` before any execute context exists. Tests also use it to
 * assert the right wall-clock target without invoking the node.
 *
 * Semantics by mode:
 *  - `timeInterval` → `now + intervalToMs(amount, unit)`
 *  - `dateTime`     → parse `params.dateTime`; invalid input falls back
 *                     to `now` so the wait resolves on the next sweep
 *                     rather than parking forever.
 *  - `webhook` / `formSubmit` → `params.resumeTimeout` is the optional
 *                     ceiling. When unset, returns a sentinel "far
 *                     future" `Date` (~year 9999) so the sweeper never
 *                     wakes the execution on its own — only the inbound
 *                     webhook / form submission can.
 */
export function computeResumeAt(params: WaitNodeParams, now: Date): Date {
	const nowMs = now.getTime();
	switch (params.mode) {
		case 'timeInterval': {
			const ms = intervalToMs(params.amount ?? 0, params.unit ?? 'seconds');
			return new Date(nowMs + ms);
		}
		case 'dateTime': {
			const raw = params.dateTime;
			if (raw === undefined) return new Date(nowMs);
			const dt = raw instanceof Date ? raw : new Date(raw);
			if (Number.isNaN(dt.getTime())) return new Date(nowMs);
			return dt;
		}
		case 'webhook':
		case 'formSubmit': {
			if (params.resumeTimeout) {
				const ms = intervalToMs(
					params.resumeTimeout.amount,
					params.resumeTimeout.unit,
				);
				return new Date(nowMs + ms);
			}
			// "Far future" sentinel — Mongo's TTL won't trip on this, and the
			// dispatcher sweeper treats it as "wait indefinitely for the
			// webhook / form to arrive". Year 9999 keeps `Date` arithmetic
			// safe and is the same sentinel n8n uses internally.
			return new Date('9999-12-31T23:59:59.000Z');
		}
		default: {
			const _exhaust: never = params.mode;
			void _exhaust;
			return new Date(nowMs);
		}
	}
}

/* ------------------------------------------------------------------ */
/* Executor                                                            */
/* ------------------------------------------------------------------ */

/**
 * The `SabFlow.Wait` node. n8n parity: `n8n-nodes-base.wait` at
 * typeVersion 1.
 *
 * Execute behaviour: this function never returns a normal
 * {@link NodeExecutionResult}. It ALWAYS throws a
 * {@link WaitResumeSignal}; the executor (Phase 7) catches the signal
 * and parks the execution. On resume, the executor re-runs the node's
 * downstream edges directly with either the original held items
 * (`timeInterval` / `dateTime`) or the inbound webhook body wrapped as
 * a single item (`webhook` / `formSubmit`).
 *
 * @throws {WaitResumeSignal} Always — this is the cooperative yield
 *   that parks the execution. Phase 7's dispatcher MUST catch this and
 *   must NOT route it through retry / error-workflow plumbing.
 */
export const WaitNode: NodeRegistration = {
	type: 'SabFlow.Wait',
	typeVersion: 1,
	description:
		'Pause the workflow until a time elapses, an absolute date is reached, an inbound webhook fires, or a generated form is submitted.',
	defaults: {
		name: 'Wait',
		color: '#80B7E2',
	},
	properties: [
		{
			displayName: 'Resume',
			name: 'mode',
			type: 'options',
			default: 'timeInterval',
			noDataExpression: true,
			description: 'When the workflow should resume execution.',
			options: [
				{ name: 'After Time Interval', value: 'timeInterval' },
				{ name: 'At Specified Time', value: 'dateTime' },
				{ name: 'On Webhook Call', value: 'webhook' },
				{ name: 'On Form Submitted', value: 'formSubmit' },
			],
		},
		{
			displayName: 'Amount',
			name: 'amount',
			type: 'number',
			default: 5,
			description: 'How many `Unit`s to wait. Used with mode = `After Time Interval`.',
		},
		{
			displayName: 'Unit',
			name: 'unit',
			type: 'options',
			default: 'minutes',
			noDataExpression: true,
			description: 'Time unit for `Amount`. Used with mode = `After Time Interval`.',
			options: [
				{ name: 'Seconds', value: 'seconds' },
				{ name: 'Minutes', value: 'minutes' },
				{ name: 'Hours', value: 'hours' },
				{ name: 'Days', value: 'days' },
			],
		},
		{
			displayName: 'Date and Time',
			name: 'dateTime',
			type: 'dateTime',
			default: '',
			description: 'Absolute timestamp to resume at. Used with mode = `At Specified Time`.',
		},
		{
			displayName: 'Limit Wait Time',
			name: 'limitWaitTime',
			type: 'boolean',
			default: false,
			noDataExpression: true,
			description:
				'For `webhook` / `formSubmit` modes: also time the wait out after a maximum duration.',
		},
		{
			displayName: 'Limit Amount',
			name: 'limitAmount',
			type: 'number',
			default: 1,
			description: 'Maximum wait duration when `Limit Wait Time` is enabled.',
		},
		{
			displayName: 'Limit Unit',
			name: 'limitUnit',
			type: 'options',
			default: 'hours',
			noDataExpression: true,
			description: 'Unit for `Limit Amount`.',
			options: [
				{ name: 'Seconds', value: 'seconds' },
				{ name: 'Minutes', value: 'minutes' },
				{ name: 'Hours', value: 'hours' },
				{ name: 'Days', value: 'days' },
			],
		},
	],

	async execute(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
		// Parameters are resolved against item 0: the wait itself does not
		// branch per-item — every input item shares the same parked state
		// and is re-emitted verbatim when the execution resumes.
		const mode = ctx.getNodeParameter<WaitMode>('mode', 0, 'timeInterval');
		const amount = ctx.getNodeParameter<number>('amount', 0, 0);
		const unit = ctx.getNodeParameter<WaitTimeUnit>('unit', 0, 'seconds');
		const dateTime = ctx.getNodeParameter<string | Date | undefined>('dateTime', 0, undefined);
		const limitWaitTime = ctx.getNodeParameter<boolean>('limitWaitTime', 0, false);
		const limitAmount = ctx.getNodeParameter<number>('limitAmount', 0, 0);
		const limitUnit = ctx.getNodeParameter<WaitTimeUnit>('limitUnit', 0, 'hours');

		// The executor stamps the active node id onto a reserved parameter
		// slot when invoking us, so the resume URL minted by the dispatcher
		// can embed it. Fall back to an empty string when the parameter
		// isn't present (manual-test path from the editor); Phase 7 patches
		// the descriptor before persisting in that case.
		const nodeId = ctx.getNodeParameter<string>('__nodeId', 0, '');
		const resumeToken = ctx.getNodeParameter<string | undefined>(
			'__resumeToken',
			0,
			undefined,
		);

		const params: WaitNodeParams = {
			mode,
			amount,
			unit,
			dateTime,
			...(limitWaitTime
				? { resumeTimeout: { amount: limitAmount, unit: limitUnit } }
				: {}),
		};

		const heldItems = ctx.getInputData();
		const now = new Date();
		const resumeAt = computeResumeAt(params, now);

		const descriptor: WaitResumeDescriptor = {
			resumeKind: mode,
			nodeId,
			resumeAt,
			...(resumeToken !== undefined ? { resumeToken } : {}),
		};

		// Throw the cooperative-yield signal. The executor (Phase 7)
		// catches it via `instanceof WaitResumeSignal`, persists the
		// descriptor + held items onto the execution doc, flips `status`
		// to `waiting`, and releases the worker slot. We must never
		// return a normal result from a Wait node.
		throw new WaitResumeSignal(descriptor, heldItems);
	},
};

export default WaitNode;
