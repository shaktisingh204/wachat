/**
 * SabFlow `Code` node (n8n-parity, typeVersion 2)
 * -----------------------------------------------
 *
 * Track B Phase 3 (sub-task #9 of 10).
 *
 * This is the modern n8n "Code" node — the successor to the legacy
 * `Function` / `FunctionItem` pair. Where the Function node (sibling
 * sub-task #8) is the single-mode all-items shim kept for backwards
 * compatibility with imported v1 workflows, the Code node:
 *
 *   - exposes both `runOnceForAllItems` and `runOnceForEachItem`,
 *   - is at `typeVersion: 2`,
 *   - selects the language (`javascript` today; `python` reserved for a
 *     future Phase 4 Pyodide-backed implementation),
 *   - enforces a tighter per-item timeout (1s) in per-item mode, vs the
 *     5s aggregate budget the Function node already uses.
 *
 * Sandboxing is owned by the Function node (sibling #8) so that the
 * isolate/vm pool, hook surface (`$json` / `$node` / `$workflow` /
 * `$itemIndex`), and OTEL spans live in exactly one place. We forward-
 * declare its `runInSandbox` export and call it twice (per-item) or once
 * (all-items). When Phase 4 swaps the Function node's underlying engine
 * (e.g. moves from `node:vm` to QuickJS / isolated-vm), the Code node
 * inherits the upgrade for free.
 *
 * Error reporting:
 *   - In `runOnceForAllItems`, sandbox errors propagate as-is.
 *   - In `runOnceForEachItem`, we wrap the inner error with the failing
 *     `itemIndex` and forward the sandbox-reported line number so the
 *     editor can highlight the offending row in the user's code.
 *
 * @module sabflow/executor/nodes/code
 */

import type {
	NodeExecutionContext,
	NodeExecutionItem,
	NodeExecutionResult,
	NodeRegistration,
} from '../contract';
import { NodeOperationError } from '../errors';

/* ------------------------------------------------------------------ */
/* Forward-decl: sandbox lives in the Function node (sibling #8).      */
/* ------------------------------------------------------------------ */

/**
 * Shape of a sandbox invocation. Forward-declared here so the Code node
 * compiles before sibling #8 (`./function`) finalises the export. The
 * Function node owns the implementation; this contract is the seam.
 *
 * - `code`        — the user's JavaScript source.
 * - `mode`        — chooses which globals are exposed and how the return
 *                   value is normalised.
 * - `items`       — full input batch (always supplied; the sandbox
 *                   surfaces it as `items` only in `runOnceForAllItems`).
 * - `itemIndex`   — required in `runOnceForEachItem`; the sandbox
 *                   surfaces `item` = `items[itemIndex]`.
 * - `timeoutMs`   — wall-clock budget for this single invocation.
 * - `ctx`         — passed through so the sandbox can build `$json` /
 *                   `$node` / `$workflow` proxies via
 *                   `ctx.getWorkflowDataProxy(itemIndex)`.
 */
export interface RunInSandboxOptions {
	code: string;
	mode: 'runOnceForAllItems' | 'runOnceForEachItem';
	items: NodeExecutionItem[];
	itemIndex?: number;
	timeoutMs: number;
	ctx: NodeExecutionContext;
}

/**
 * Forward-declared return shape from the sandbox. `value` is whatever the
 * user's `return` evaluated to (the caller normalises it into
 * `NodeExecutionItem[]`). `lineNumber` is the 1-indexed source line the
 * sandbox blamed when `error` is populated — used to give the editor a
 * precise cursor target.
 */
export interface RunInSandboxResult {
	value: unknown;
	error?: { message: string; lineNumber?: number; stack?: string };
}

/**
 * Lazy ESM import of the sibling Function node's sandbox runner so we
 * don't pull its (potentially heavy) dependencies at module-load time
 * and so sub-task #8 can land asynchronously without TS errors here.
 *
 * @internal
 */
async function runInSandbox(opts: RunInSandboxOptions): Promise<RunInSandboxResult> {
	// Dynamic import keeps the dependency edge soft; the sibling export
	// must be named `runInSandbox` with this exact signature. The
	// `@ts-expect-error` is intentional: sibling sub-task #8 (`./function`)
	// is shipped in parallel; this directive evaporates the moment that
	// module lands. If you remove that file, TS will surface this as an
	// unused-directive error and you'll know to fix the import.
	// @ts-expect-error forward-decl: './function' is owned by sibling sub-task #8.
	const mod = (await import('./function')) as {
		runInSandbox: (o: RunInSandboxOptions) => Promise<RunInSandboxResult>;
	};
	return mod.runInSandbox(opts);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Per-item timeout — strictly tighter than the all-items budget. */
const PER_ITEM_TIMEOUT_MS = 1_000;
/** All-items aggregate timeout — matches the Function node's budget. */
const ALL_ITEMS_TIMEOUT_MS = 5_000;

/**
 * Normalise whatever the user returned from their code into the canonical
 * `NodeExecutionItem[]` shape. Accepts (in n8n parity order):
 *
 *   - `undefined` / `null`     → empty array (treated as "drop this item")
 *   - a single `NodeExecutionItem`-shaped object (has `json`) → wrapped
 *   - a single plain object    → wrapped as `{ json }`
 *   - an array of any of the above (recursively normalised)
 *
 * Anything else (primitives, functions, etc.) is a `NodeOperationError`
 * because n8n historically refuses to ship non-object payloads downstream.
 *
 * @internal
 */
function normalizeReturn(value: unknown, itemIndex: number | undefined): NodeExecutionItem[] {
	if (value === undefined || value === null) return [];

	if (Array.isArray(value)) {
		const out: NodeExecutionItem[] = [];
		for (const entry of value) {
			out.push(...normalizeReturn(entry, itemIndex));
		}
		return out;
	}

	if (typeof value === 'object') {
		const obj = value as Record<string, unknown>;
		// Already in NodeExecutionItem shape?
		if (typeof obj.json === 'object' && obj.json !== null) {
			const item: NodeExecutionItem = { json: obj.json as Record<string, unknown> };
			if (obj.binary && typeof obj.binary === 'object') {
				item.binary = obj.binary as NodeExecutionItem['binary'];
			}
			if (obj.pairedItem !== undefined) {
				item.pairedItem = obj.pairedItem as NodeExecutionItem['pairedItem'];
			}
			return [item];
		}
		// Plain object → treat as `{ json: <obj> }`.
		return [{ json: obj }];
	}

	throw new NodeOperationError(
		'Code node returned a non-object value; expected an item, an array of items, or an object',
		{ itemIndex, nodeType: 'SabFlow.Code' },
	);
}

/* ------------------------------------------------------------------ */
/* Executor                                                            */
/* ------------------------------------------------------------------ */

/**
 * The `SabFlow.Code` node executor. n8n parity: `n8n-nodes-base.code` at
 * typeVersion 2.
 */
export const CodeNode: NodeRegistration = {
	type: 'SabFlow.Code',
	typeVersion: 2,
	description:
		'Run custom JavaScript (Python coming) against the input items. ' +
		'Modern n8n-parity replacement for the legacy Function node.',
	defaults: { name: 'Code', color: '#FF6D5A' },
	properties: [
		{
			displayName: 'Mode',
			name: 'mode',
			type: 'options',
			default: 'runOnceForAllItems',
			noDataExpression: true,
			description:
				'Whether to invoke the snippet once for the full batch (`items`) ' +
				'or once per input item (`item`).',
			options: [
				{ name: 'Run Once for All Items', value: 'runOnceForAllItems' },
				{ name: 'Run Once for Each Item', value: 'runOnceForEachItem' },
			],
		},
		{
			displayName: 'Language',
			name: 'language',
			type: 'options',
			default: 'javascript',
			noDataExpression: true,
			description: 'The language the snippet is written in.',
			options: [
				{ name: 'JavaScript', value: 'javascript' },
				{ name: 'Python (Beta)', value: 'python' },
			],
		},
		{
			displayName: 'JavaScript',
			name: 'jsCode',
			type: 'string',
			default: '// Loop over input items and add a new field.\nfor (const item of items) {\n  item.json.myNewField = 1;\n}\nreturn items;',
			description:
				'JavaScript source. Globals: `items` (all-items mode) or ' +
				'`item` (per-item mode), plus `$json`, `$node`, `$workflow`, ' +
				'`$itemIndex`.',
			placeholder: '// Your code here',
			required: true,
		},
	],

	async execute(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
		const inputItems = ctx.getInputData();
		// Per n8n: parameters are resolved against item 0 because the code
		// node's params themselves don't take expressions (the user's code
		// runs against every item via the sandbox proxies).
		const mode = ctx.getNodeParameter<'runOnceForAllItems' | 'runOnceForEachItem'>(
			'mode',
			0,
			'runOnceForAllItems',
		);
		const language = ctx.getNodeParameter<'javascript' | 'python'>('language', 0, 'javascript');
		const jsCode = ctx.getNodeParameter<string>('jsCode', 0, '');

		if (language === 'python') {
			// Reserved for Phase 4 (Pyodide-backed sandbox). Surfacing as a
			// NodeOperationError (non-retryable) is the right semantics: it
			// won't start working on retry.
			throw new NodeOperationError(
				'Python execution is not yet implemented in the SabFlow Code node. ' +
					'Switch the language to JavaScript or wait for Phase 4.',
				{ nodeType: 'SabFlow.Code', details: { reason: 'NotImplemented' } },
			);
		}

		if (typeof jsCode !== 'string' || jsCode.trim().length === 0) {
			throw new NodeOperationError('Code node `jsCode` is empty.', {
				nodeType: 'SabFlow.Code',
				details: { paramName: 'jsCode' },
			});
		}

		/* -------------------------------------------------------------- */
		/* runOnceForAllItems — single sandbox call, sees `items`.        */
		/* -------------------------------------------------------------- */
		if (mode === 'runOnceForAllItems') {
			const res = await runInSandbox({
				code: jsCode,
				mode: 'runOnceForAllItems',
				items: inputItems,
				timeoutMs: ALL_ITEMS_TIMEOUT_MS,
				ctx,
			});
			if (res.error) {
				throw new NodeOperationError(
					`Code node failed: ${res.error.message}` +
						(res.error.lineNumber !== undefined ? ` (line ${res.error.lineNumber})` : ''),
					{
						nodeType: 'SabFlow.Code',
						details: {
							lineNumber: res.error.lineNumber,
							sandboxStack: res.error.stack,
						},
					},
				);
			}
			return { output: [normalizeReturn(res.value, undefined)] };
		}

		/* -------------------------------------------------------------- */
		/* runOnceForEachItem — one sandbox call per item, 1s budget each.*/
		/* -------------------------------------------------------------- */
		const accumulated: NodeExecutionItem[] = [];
		for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex++) {
			const res = await runInSandbox({
				code: jsCode,
				mode: 'runOnceForEachItem',
				items: inputItems,
				itemIndex,
				timeoutMs: PER_ITEM_TIMEOUT_MS,
				ctx,
			});
			if (res.error) {
				// Per-item mode pinpoints the failing row AND the line — the
				// editor uses both for its inline error overlay.
				throw new NodeOperationError(
					`Code node failed on item ${itemIndex}: ${res.error.message}` +
						(res.error.lineNumber !== undefined ? ` (line ${res.error.lineNumber})` : ''),
					{
						nodeType: 'SabFlow.Code',
						itemIndex,
						details: {
							lineNumber: res.error.lineNumber,
							sandboxStack: res.error.stack,
						},
					},
				);
			}
			accumulated.push(...normalizeReturn(res.value, itemIndex));
		}
		return { output: [accumulated] };
	},
};

export default CodeNode;
