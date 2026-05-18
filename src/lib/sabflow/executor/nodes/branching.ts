/**
 * SabFlow branching nodes — `SabFlow.If` and `SabFlow.Switch`.
 *
 * Track B Phase 3 sub-task #5 of 10.
 *
 * Mirrors n8n's branching node surface so workflows imported from n8n
 * route identically inside SabFlow:
 *   - `SabFlow.If`     (typeVersion 2) ~ n8n `n8n-nodes-base.if`     v2
 *   - `SabFlow.Switch` (typeVersion 3) ~ n8n `n8n-nodes-base.switch` v3
 *
 * Operator semantics follow n8n verbatim for portability:
 *   string   : contains | notContains | startsWith | endsWith | equal | notEqual | regex
 *   number   : equal | notEqual | gt | lt | gte | lte
 *   boolean  : equal | notEqual
 *   dateTime : before | after
 *
 * Each item is evaluated independently and routed onto exactly one output
 * port. For `If` the shape is `[truePort, falsePort]`; for `Switch` it is
 * `[port0, port1, …, portN-1]` where N is the highest `output` index
 * referenced by `rules` plus one for the optional `fallbackOutput`.
 *
 * @module sabflow/executor/nodes/branching
 */

import type {
	NodeExecutionContext,
	NodeExecutionItem,
	NodeExecutionResult,
	NodeRegistration,
} from '../contract';
import { NodeOperationError } from '../errors';

/* ------------------------------------------------------------------ */
/* Operator types                                                      */
/* ------------------------------------------------------------------ */

/** Operator strings supported on string-typed comparisons. */
export type StringOperation =
	| 'contains'
	| 'notContains'
	| 'startsWith'
	| 'endsWith'
	| 'equal'
	| 'notEqual'
	| 'regex';

/** Operator strings supported on number-typed comparisons. */
export type NumberOperation = 'equal' | 'notEqual' | 'gt' | 'lt' | 'gte' | 'lte';

/** Operator strings supported on boolean-typed comparisons. */
export type BooleanOperation = 'equal' | 'notEqual';

/** Operator strings supported on dateTime-typed comparisons. */
export type DateTimeOperation = 'before' | 'after';

/** Union of every operator across every typed bucket. */
export type ConditionOperation =
	| StringOperation
	| NumberOperation
	| BooleanOperation
	| DateTimeOperation;

/* ------------------------------------------------------------------ */
/* Condition shapes                                                    */
/* ------------------------------------------------------------------ */

/** Single typed entry inside the `If` node's `conditions` fixedCollection. */
export interface ConditionEntry<Op extends ConditionOperation = ConditionOperation> {
	value1: unknown;
	operation: Op;
	value2: unknown;
}

/** `If` node `conditions` shape — four typed buckets, n8n parity. */
export interface IfConditions {
	boolean?: ConditionEntry<BooleanOperation>[];
	number?: ConditionEntry<NumberOperation>[];
	string?: ConditionEntry<StringOperation>[];
	dateTime?: ConditionEntry<DateTimeOperation>[];
}

/** `If` node combinator across condition entries. */
export type CombineOperation = 'all' | 'any';

/** `Switch` node single rule (rules-mode). */
export interface SwitchRule {
	operation: ConditionOperation;
	value1: unknown;
	value2: unknown;
	output: number;
}

/* ------------------------------------------------------------------ */
/* Coercion helpers                                                    */
/* ------------------------------------------------------------------ */

/** Operator → which typed bucket it belongs to. Used for coercion routing. */
const OP_KIND: Record<ConditionOperation, 'string' | 'number' | 'boolean' | 'dateTime'> = {
	contains: 'string',
	notContains: 'string',
	startsWith: 'string',
	endsWith: 'string',
	regex: 'string',
	gt: 'number',
	lt: 'number',
	gte: 'number',
	lte: 'number',
	before: 'dateTime',
	after: 'dateTime',
	// `equal` / `notEqual` are polymorphic — handled separately.
	equal: 'string',
	notEqual: 'string',
};

/**
 * Coerce `value` toward `target` type with n8n-compatible loose rules.
 * Returns `undefined` when coercion is impossible (caller throws).
 *
 * @internal
 */
function coerce(value: unknown, target: 'string' | 'number' | 'boolean' | 'dateTime'): unknown {
	if (value === null || value === undefined) {
		if (target === 'string') return '';
		if (target === 'number') return 0;
		if (target === 'boolean') return false;
		return undefined;
	}
	switch (target) {
		case 'string':
			return typeof value === 'string' ? value : String(value);
		case 'number': {
			if (typeof value === 'number') return value;
			if (typeof value === 'boolean') return value ? 1 : 0;
			if (typeof value === 'string') {
				const trimmed = value.trim();
				if (trimmed === '') return 0;
				const n = Number(trimmed);
				return Number.isFinite(n) ? n : undefined;
			}
			return undefined;
		}
		case 'boolean': {
			if (typeof value === 'boolean') return value;
			if (typeof value === 'number') return value !== 0;
			if (typeof value === 'string') {
				const v = value.trim().toLowerCase();
				if (v === 'true' || v === '1' || v === 'yes') return true;
				if (v === 'false' || v === '0' || v === 'no' || v === '') return false;
				return undefined;
			}
			return undefined;
		}
		case 'dateTime': {
			if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
			if (typeof value === 'number') {
				const d = new Date(value);
				return Number.isNaN(d.getTime()) ? undefined : d;
			}
			if (typeof value === 'string') {
				const ms = Date.parse(value);
				return Number.isNaN(ms) ? undefined : new Date(ms);
			}
			return undefined;
		}
	}
}

/**
 * Pick the comparison kind for `equal` / `notEqual` from the *actual* runtime
 * shape of `value1` so we don't accidentally string-compare two numbers.
 *
 * @internal
 */
function inferEqualKind(
	value1: unknown,
	value2: unknown,
): 'string' | 'number' | 'boolean' | 'dateTime' {
	if (typeof value1 === 'number' || typeof value2 === 'number') return 'number';
	if (typeof value1 === 'boolean' || typeof value2 === 'boolean') return 'boolean';
	if (value1 instanceof Date || value2 instanceof Date) return 'dateTime';
	return 'string';
}

/* ------------------------------------------------------------------ */
/* Public helper — evaluateCondition                                   */
/* ------------------------------------------------------------------ */

/**
 * Evaluate a single (value1, operation, value2) triple.
 *
 * Exported so the executor's branching tests can exercise operator
 * semantics directly without spinning up a full execution context. The
 * `If` and `Switch` node executors both delegate to this helper.
 *
 * Throws {@link NodeOperationError} on unresolvable type mismatches when
 * `strict` is true (default). When `strict` is false, an unresolvable
 * comparison short-circuits to `false` to match n8n's `continueOnFail`
 * fall-through behaviour.
 *
 * @example
 * ```ts
 * evaluateCondition('abc', 'contains', 'b'); // true
 * evaluateCondition('5',   'gt',       3);   // true (coerced)
 * evaluateCondition('x',   'gt',       3);   // throws NodeOperationError
 * ```
 */
export function evaluateCondition(
	value1: unknown,
	operation: ConditionOperation,
	value2: unknown,
	strict = true,
): boolean {
	const kind =
		operation === 'equal' || operation === 'notEqual'
			? inferEqualKind(value1, value2)
			: OP_KIND[operation];

	if (kind === undefined) {
		if (strict) {
			throw new NodeOperationError(`Unknown branching operation: ${String(operation)}`, {
				details: { operation },
			});
		}
		return false;
	}

	const a = coerce(value1, kind);
	const b = coerce(value2, kind);
	if (a === undefined || b === undefined) {
		if (strict) {
			throw new NodeOperationError(
				`Branching operator "${operation}" requires both operands to coerce to ${kind}`,
				{ details: { operation, value1, value2, expected: kind } },
			);
		}
		return false;
	}

	switch (operation) {
		// string
		case 'contains':
			return (a as string).includes(b as string);
		case 'notContains':
			return !(a as string).includes(b as string);
		case 'startsWith':
			return (a as string).startsWith(b as string);
		case 'endsWith':
			return (a as string).endsWith(b as string);
		case 'regex': {
			try {
				// Allow `/pattern/flags` literal form.
				const src = b as string;
				const m = /^\/(.+)\/([gimsuy]*)$/.exec(src);
				const re = m ? new RegExp(m[1]!, m[2]) : new RegExp(src);
				return re.test(a as string);
			} catch (cause) {
				if (strict) {
					throw new NodeOperationError(`Invalid regex pattern: ${String(b)}`, {
						details: { pattern: b },
						cause,
					});
				}
				return false;
			}
		}
		// number
		case 'gt':
			return (a as number) > (b as number);
		case 'lt':
			return (a as number) < (b as number);
		case 'gte':
			return (a as number) >= (b as number);
		case 'lte':
			return (a as number) <= (b as number);
		// dateTime
		case 'before':
			return (a as Date).getTime() < (b as Date).getTime();
		case 'after':
			return (a as Date).getTime() > (b as Date).getTime();
		// polymorphic
		case 'equal':
			if (kind === 'dateTime') return (a as Date).getTime() === (b as Date).getTime();
			return a === b;
		case 'notEqual':
			if (kind === 'dateTime') return (a as Date).getTime() !== (b as Date).getTime();
			return a !== b;
	}
}

/* ------------------------------------------------------------------ */
/* IfNode                                                              */
/* ------------------------------------------------------------------ */

/**
 * Resolve every entry in an `IfConditions` bag, combining results with the
 * `combineOperation` (`all` = AND, `any` = OR). Empty bag → true.
 *
 * @internal
 */
function evaluateIfConditions(
	conditions: IfConditions,
	combine: CombineOperation,
	strict: boolean,
): boolean {
	const all: Array<{ entry: ConditionEntry; bucket: keyof IfConditions }> = [];
	if (conditions.boolean) for (const e of conditions.boolean) all.push({ entry: e, bucket: 'boolean' });
	if (conditions.number) for (const e of conditions.number) all.push({ entry: e, bucket: 'number' });
	if (conditions.string) for (const e of conditions.string) all.push({ entry: e, bucket: 'string' });
	if (conditions.dateTime)
		for (const e of conditions.dateTime) all.push({ entry: e, bucket: 'dateTime' });

	if (all.length === 0) return true;

	if (combine === 'any') {
		for (const { entry } of all) {
			if (evaluateCondition(entry.value1, entry.operation, entry.value2, strict)) return true;
		}
		return false;
	}
	// combine === 'all'
	for (const { entry } of all) {
		if (!evaluateCondition(entry.value1, entry.operation, entry.value2, strict)) return false;
	}
	return true;
}

/**
 * `SabFlow.If` node registration.
 *
 * Splits incoming items onto two output ports based on per-item evaluation
 * of the `conditions` bag. typeVersion 2 — wire-compatible with the n8n
 * `If` v2 node so workflow JSON imported from n8n routes identically.
 */
export const IfNode: NodeRegistration = {
	type: 'SabFlow.If',
	typeVersion: 2,
	description:
		'Route incoming items onto a true / false output port based on typed conditions (n8n If v2 parity).',
	defaults: { name: 'If', color: '#408000' },
	properties: [
		{
			displayName: 'Conditions',
			name: 'conditions',
			type: 'fixedCollection',
			default: {},
			description:
				'Typed condition buckets (boolean / number / string / dateTime). Each entry is { value1, operation, value2 }.',
		},
		{
			displayName: 'Combine',
			name: 'combineOperation',
			type: 'options',
			default: 'all',
			options: [
				{ name: 'All (AND)', value: 'all' },
				{ name: 'Any (OR)', value: 'any' },
			],
			description: 'Whether all conditions must match (AND) or any single one (OR).',
		},
	],
	async execute(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
		const items = ctx.getInputData(0);
		const strict = !ctx.continueOnFail();
		const trueItems: NodeExecutionItem[] = [];
		const falseItems: NodeExecutionItem[] = [];

		for (let i = 0; i < items.length; i++) {
			const item = items[i]!;
			const conditions = ctx.getNodeParameter<IfConditions>('conditions', i, {}) ?? {};
			const combine = ctx.getNodeParameter<CombineOperation>('combineOperation', i, 'all');
			let matched: boolean;
			try {
				matched = evaluateIfConditions(conditions, combine, strict);
			} catch (err) {
				if (!strict) {
					falseItems.push(item);
					continue;
				}
				throw err instanceof NodeOperationError
					? err
					: new NodeOperationError('If: failed to evaluate conditions', {
							itemIndex: i,
							cause: err,
						});
			}
			(matched ? trueItems : falseItems).push(item);
		}

		return { output: [trueItems, falseItems] };
	},
};

/* ------------------------------------------------------------------ */
/* SwitchNode                                                          */
/* ------------------------------------------------------------------ */

/**
 * Compute the number of output ports the Switch must allocate from its
 * rules and fallback. Used to ensure unreferenced ports still appear in
 * the output array (as empty `[]`).
 *
 * @internal
 */
function switchPortCount(rules: SwitchRule[], fallback: number | undefined): number {
	let max = -1;
	for (const r of rules) if (typeof r.output === 'number' && r.output > max) max = r.output;
	if (typeof fallback === 'number' && fallback > max) max = fallback;
	return max + 1;
}

/**
 * `SabFlow.Switch` node registration.
 *
 * N-way fan-out router. typeVersion 3 — wire-compatible with the n8n
 * `Switch` v3 node. In `rules` mode each rule maps a condition to an
 * `output` port index; the first matching rule wins. Non-matching items
 * are routed to `fallbackOutput` when provided. `expression` mode lets
 * the user compute the output index inline via the expression engine —
 * Phase 3 contract-only stub here; the live evaluation hook is wired in
 * sub-task #7 alongside the expression engine.
 */
export const SwitchNode: NodeRegistration = {
	type: 'SabFlow.Switch',
	typeVersion: 3,
	description:
		'N-way router. In rules mode the first matching rule selects the output port; non-matches go to fallbackOutput (n8n Switch v3 parity).',
	defaults: { name: 'Switch', color: '#506000' },
	properties: [
		{
			displayName: 'Mode',
			name: 'mode',
			type: 'options',
			default: 'rules',
			options: [
				{ name: 'Rules', value: 'rules' },
				{ name: 'Expression', value: 'expression' },
			],
			description: 'Routing strategy. Rules: evaluate typed rules. Expression: compute index inline.',
		},
		{
			displayName: 'Rules',
			name: 'rules',
			type: 'fixedCollection',
			default: { rules: [] },
			description:
				'Ordered rules; first match wins. Each rule is { operation, value1, value2, output }.',
		},
		{
			displayName: 'Fallback Output',
			name: 'fallbackOutput',
			type: 'number',
			default: -1,
			description: 'Output port for items that match no rule. -1 drops the item.',
		},
		{
			displayName: 'Expression',
			name: 'expression',
			type: 'string',
			default: '',
			description: 'When mode = expression, evaluated to a port index (number).',
			noDataExpression: false,
		},
	],
	async execute(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
		const items = ctx.getInputData(0);
		const strict = !ctx.continueOnFail();

		// Look-ahead pass: figure out total port count using the first item's
		// parameters. Per-item parameter expressions may still resolve to
		// different indices, but the port array width is fixed up-front so
		// downstream wiring is stable.
		const firstRules =
			items.length > 0
				? ctx.getNodeParameter<{ rules?: SwitchRule[] } | SwitchRule[]>('rules', 0, [])
				: [];
		const headRules: SwitchRule[] = Array.isArray(firstRules)
			? firstRules
			: Array.isArray((firstRules as { rules?: SwitchRule[] })?.rules)
				? (firstRules as { rules: SwitchRule[] }).rules
				: [];
		const headFallback = items.length > 0 ? ctx.getNodeParameter<number>('fallbackOutput', 0, -1) : -1;
		const portCount = Math.max(1, switchPortCount(headRules, headFallback));

		const output: NodeExecutionItem[][] = Array.from({ length: portCount }, () => []);

		for (let i = 0; i < items.length; i++) {
			const item = items[i]!;
			const mode = ctx.getNodeParameter<'rules' | 'expression'>('mode', i, 'rules');
			const fallback = ctx.getNodeParameter<number>('fallbackOutput', i, -1);
			const rulesParam = ctx.getNodeParameter<{ rules?: SwitchRule[] } | SwitchRule[]>(
				'rules',
				i,
				[],
			);
			const rules: SwitchRule[] = Array.isArray(rulesParam)
				? rulesParam
				: Array.isArray((rulesParam as { rules?: SwitchRule[] })?.rules)
					? (rulesParam as { rules: SwitchRule[] }).rules
					: [];

			let target: number;
			try {
				if (mode === 'expression') {
					// Expression mode: the resolved parameter is expected to be a
					// pre-evaluated number coming back from the expression engine.
					target = ctx.getNodeParameter<number>('expression', i, -1);
					if (typeof target !== 'number' || !Number.isFinite(target)) {
						if (strict) {
							throw new NodeOperationError(
								'Switch (expression mode) did not resolve to a number',
								{ itemIndex: i, details: { resolved: target } },
							);
						}
						target = fallback;
					}
				} else {
					target = fallback;
					for (const rule of rules) {
						if (evaluateCondition(rule.value1, rule.operation, rule.value2, strict)) {
							target = rule.output;
							break;
						}
					}
				}
			} catch (err) {
				if (!strict) {
					if (fallback >= 0 && fallback < portCount) output[fallback]!.push(item);
					continue;
				}
				throw err instanceof NodeOperationError
					? err
					: new NodeOperationError('Switch: failed to evaluate rules', {
							itemIndex: i,
							cause: err,
						});
			}

			if (target >= 0 && target < portCount) {
				output[target]!.push(item);
			} else if (target >= portCount) {
				// Rule referenced an out-of-range port — grow the output array
				// so we don't silently drop the item.
				while (output.length <= target) output.push([]);
				output[target]!.push(item);
			}
			// target < 0 → drop (matches n8n fallbackOutput = -1 semantics).
		}

		return { output };
	},
};
