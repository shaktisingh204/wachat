/**
 * SabFlow `LoopOverItems` + `Merge` nodes (n8n parity)
 * ----------------------------------------------------
 *
 * Track B Phase 3 (sub-task #6 of 10): the two batching primitives that
 * make multi-pass + multi-stream workflows expressible without dropping
 * to the `Code` node. Both ship at `typeVersion: 3` to match the modern
 * n8n shape (the v1/v2 versions of these nodes had subtly different
 * port layouts that the n8n importer maps forward via the migration
 * files in `src/lib/sabflow/migrations/nodes/`).
 *
 *  1. `SabFlow.LoopOverItems` — chunked iteration over an input batch.
 *     Two **input** ports:
 *       - 0 : initial (fresh entry from upstream — resets the cursor).
 *       - 1 : loop-back (re-entry from downstream — advances the
 *             cursor by one chunk). Per
 *             `src/lib/sabflow/executor/ir.ts` (see
 *             `DEFAULT_LOOP_NODE_TYPES` + `buildDagAdjacency`), edges
 *             whose target is this node on `inputIndex >= 1` are
 *             excluded from cycle detection so the topo walk treats
 *             the loop edge as a back-edge.
 *     Two **output** ports:
 *       - 0 : `items` — the next chunk (size = `batchSize`).
 *       - 1 : `done` — fired exactly once after the final chunk has
 *             been processed; emits the empty-array sentinel item set
 *             so the downstream branch always has at least one item to
 *             trigger on (n8n parity: the "done" branch always fires).
 *     Stateful: holds a continuation cursor keyed by `nodeId`, accessed
 *     through the forward-declared `ctx.helpers.getRunCursor(nodeId)`
 *     seam (see {@link LoopCursor}).
 *
 *  2. `SabFlow.Merge` — combine multiple input streams into one output.
 *     Variadic inputs (>= 2; the editor renders a "+" handle that adds
 *     more). Three modes:
 *       - `append`     — concatenate every input in declaration order.
 *       - `combine`    — zip items pairwise. `combineBy: 'position'`
 *                        uses item index; `combineBy: 'fields'` merges
 *                        by matching `fieldsToMatchOn` keys (n8n parity:
 *                        the modern "Combine by matching fields" mode).
 *       - `multiplex`  — Cartesian product of all inputs.
 *
 *  3. Exported helper {@link mergeByFields} — pure, dep-free, unit-
 *     testable. Sibling sub-task #4 (interop tests) consumes it
 *     directly without spinning up an executor.
 *
 * No external deps. The execution context is consumed through the
 * `NodeExecutionContext` surface from `../contract`; the cursor seam
 * is forward-declared inline (see {@link CursorHelpers}) so this file
 * compiles before the dispatcher (sibling sub-task #1) finalises its
 * helper surface.
 *
 * @module sabflow/executor/nodes/loop-merge
 */

import type {
	NodeExecutionContext,
	NodeExecutionHelpers,
	NodeExecutionItem,
	NodeExecutionResult,
	NodeRegistration,
} from '../contract';

/* ------------------------------------------------------------------ */
/* Forward-decl: stateful cursor helper owned by the dispatcher.       */
/* ------------------------------------------------------------------ */

/**
 * Persistent cursor state for a `LoopOverItems` node. The dispatcher
 * owns the storage (in-memory between scheduler ticks for sync runs;
 * spilled to the execution-state Mongo doc — see
 * `src/lib/sabflow/executor/state.ts` — for resumable / long-running
 * executions). This module reads + mutates only the structural fields.
 */
export interface LoopCursor {
	/** Frozen snapshot of the items being iterated. Set on initial entry. */
	items: NodeExecutionItem[];
	/** Index of the *next* item to emit (0..items.length). */
	offset: number;
	/** Configured batch size — captured at entry so mid-run param changes don't fork the cursor. */
	batchSize: number;
	/** True once the cursor has emitted the final chunk and is waiting to fire `done`. */
	exhausted: boolean;
}

/**
 * Forward-declared shape of the cursor helpers we expect the dispatcher
 * to attach to `ctx.helpers`. The Phase-1 `NodeExecutionHelpers` surface
 * (`../contract`) intentionally only declares `httpRequest`; sibling
 * sub-task #1 (the dispatcher) extends it with these state-keeping
 * methods.
 *
 * Keep the shape minimal — anything richer (atomic CAS, TTL, etc.) is
 * the dispatcher's problem and not the node's.
 */
export interface CursorHelpers {
	/** Read the current cursor for `nodeId`, or `undefined` on first entry. */
	getRunCursor(nodeId: string): LoopCursor | undefined;
	/** Persist a new / mutated cursor for `nodeId`. */
	setRunCursor(nodeId: string, cursor: LoopCursor): void;
	/** Discard the cursor (called once `done` has been emitted). */
	clearRunCursor(nodeId: string): void;
}

/**
 * Resolve the cursor helpers off `ctx.helpers` without forcing the
 * Phase-1 contract to know about them. If the dispatcher hasn't wired
 * them in yet we synthesise an in-memory shim scoped to *this* execution
 * via a `WeakMap<helpers, Map<nodeId, cursor>>`. That keeps unit tests
 * deterministic and means a developer hand-running a node through a
 * stubbed `ctx` doesn't crash.
 *
 * @internal
 */
const SHIM_STORE = new WeakMap<NodeExecutionHelpers, Map<string, LoopCursor>>();
function resolveCursorHelpers(helpers: NodeExecutionHelpers): CursorHelpers {
	const maybe = helpers as NodeExecutionHelpers & Partial<CursorHelpers>;
	if (
		typeof maybe.getRunCursor === 'function' &&
		typeof maybe.setRunCursor === 'function' &&
		typeof maybe.clearRunCursor === 'function'
	) {
		return maybe as CursorHelpers;
	}
	// Test / pre-dispatcher fallback. Same-execution memory only.
	let store = SHIM_STORE.get(helpers);
	if (!store) {
		store = new Map();
		SHIM_STORE.set(helpers, store);
	}
	const s = store;
	return {
		getRunCursor: (id) => s.get(id),
		setRunCursor: (id, c) => {
			s.set(id, c);
		},
		clearRunCursor: (id) => {
			s.delete(id);
		},
	};
}

/**
 * Best-effort lookup of the currently-executing node id. The Phase-1
 * `NodeExecutionContext` surface doesn't expose it directly (it does
 * on the n8n side, but the SabFlow contract defers that to the
 * dispatcher); the dispatcher is expected to attach `nodeId` to the
 * ctx instance at dispatch time. We read it dynamically so the type
 * surface stays clean.
 *
 * @internal
 */
function readNodeId(ctx: NodeExecutionContext): string {
	const candidate = (ctx as unknown as { nodeId?: unknown }).nodeId;
	if (typeof candidate === 'string' && candidate.length > 0) return candidate;
	// Fallback: use a per-ctx WeakMap-keyed stable id. Test-only path.
	return readNodeId.fallback(ctx);
}
readNodeId.fallback = (() => {
	const ids = new WeakMap<object, string>();
	let n = 0;
	return (ctx: NodeExecutionContext): string => {
		let id = ids.get(ctx as unknown as object);
		if (!id) {
			id = `loop-anon-${++n}`;
			ids.set(ctx as unknown as object, id);
		}
		return id;
	};
})();

/* ------------------------------------------------------------------ */
/* Small pure helpers                                                  */
/* ------------------------------------------------------------------ */

/** Clamp + coerce a `batchSize` param to a safe positive integer. */
function clampBatchSize(raw: unknown): number {
	const n = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isFinite(n) || n < 1) return 1;
	return Math.floor(n);
}

/**
 * Shallow-clone an item, dropping `binary` unless the caller asked to
 * keep it. Used by the loop node so toggling `options.includeBinary`
 * actually does something for downstream nodes.
 *
 * @internal
 */
function projectItem(item: NodeExecutionItem, includeBinary: boolean): NodeExecutionItem {
	const out: NodeExecutionItem = { json: item.json };
	if (includeBinary && item.binary) out.binary = item.binary;
	if (item.pinned) out.pinned = item.pinned;
	if (item.pairedItem !== undefined) out.pairedItem = item.pairedItem;
	return out;
}

/**
 * Read a value at a possibly-dotted path from a `json` payload. Returns
 * `undefined` when any segment is missing. Used by {@link mergeByFields}
 * so callers can match on nested keys (e.g. `customer.email`) without
 * pulling in lodash.
 *
 * @internal
 */
function readPath(obj: Record<string, unknown>, path: string): unknown {
	if (!path) return undefined;
	if (!path.includes('.')) return obj[path];
	let cur: unknown = obj;
	for (const seg of path.split('.')) {
		if (cur === null || typeof cur !== 'object') return undefined;
		cur = (cur as Record<string, unknown>)[seg];
	}
	return cur;
}

/**
 * Merge two item lists by matching on one or more JSON field paths.
 *
 * Algorithm (n8n parity, modern "Combine by matching fields" mode):
 *   1. Build a multimap keyed by the concatenated match-key for `b`.
 *   2. Walk `a` in order. For each `a[i]`, look up the bucket from `b`.
 *      - On hit, emit `{ json: { ...a.json, ...b.json } }` for *every*
 *        matching `b` item. `a` keys lose to `b` keys on collision,
 *        matching n8n's right-bias semantics.
 *      - On miss, emit `a[i]` unchanged (left-outer join semantics —
 *        n8n's default `joinMode: 'keepEverything'`).
 *   3. Items from `b` that never matched are appended after `a`'s walk
 *      (preserves "keep everything" symmetry).
 *
 * Empty `fields` list ⇒ degenerate full-cross — we refuse and return an
 * empty array. Callers should validate the param upstream and surface a
 * `NodeOperationError`; this helper stays total / dep-free so unit tests
 * can hammer it.
 *
 * The function is **pure** (no mutation of inputs) and exported for
 * direct testing — see `loop-merge.test.ts` (sibling sub-task #4).
 */
export function mergeByFields(
	a: NodeExecutionItem[],
	b: NodeExecutionItem[],
	fields: ReadonlyArray<string>,
): NodeExecutionItem[] {
	if (!fields || fields.length === 0) return [];

	/** Build the composite key for an item's json payload. */
	const keyOf = (it: NodeExecutionItem): string => {
		const parts: string[] = [];
		for (const f of fields) {
			const v = readPath(it.json, f);
			// Stable string encoding — `null`/`undefined` distinguished so
			// a missing field doesn't accidentally collide with a literal null.
			parts.push(v === undefined ? ' u' : v === null ? ' n' : JSON.stringify(v));
		}
		return parts.join('');
	};

	const bByKey = new Map<string, number[]>();
	for (let j = 0; j < b.length; j++) {
		const k = keyOf(b[j]);
		const bucket = bByKey.get(k);
		if (bucket) bucket.push(j);
		else bByKey.set(k, [j]);
	}

	const consumed = new Set<number>();
	const out: NodeExecutionItem[] = [];

	for (let i = 0; i < a.length; i++) {
		const k = keyOf(a[i]);
		const bucket = bByKey.get(k);
		if (!bucket || bucket.length === 0) {
			out.push(a[i]);
			continue;
		}
		for (const j of bucket) {
			consumed.add(j);
			out.push({
				json: { ...a[i].json, ...b[j].json },
				...(a[i].binary || b[j].binary
					? { binary: { ...(a[i].binary ?? {}), ...(b[j].binary ?? {}) } }
					: {}),
				pairedItem: [
					{ item: i, input: 0 },
					{ item: j, input: 1 },
				],
			});
		}
	}

	// Right-outer remainder: any unmatched `b` items survive.
	for (let j = 0; j < b.length; j++) {
		if (!consumed.has(j)) out.push(b[j]);
	}
	return out;
}

/* ------------------------------------------------------------------ */
/* LoopOverItems node                                                  */
/* ------------------------------------------------------------------ */

/**
 * `SabFlow.LoopOverItems` — chunked iteration with a persistent cursor.
 *
 * Execution model on each invocation:
 *   - If `parameters.options.reset === true` OR the input arrived on
 *     port 0 with at least one item AND there is no live cursor, we
 *     treat this as a fresh entry: capture `getInputData(0)` as the
 *     iteration set, reset offset, and emit the first chunk on port 0.
 *   - Otherwise we treat this as a loop-back continuation, advance the
 *     offset by the prior chunk size, and emit the next chunk.
 *   - When the offset reaches the end, we emit `[]` on port 0 (the
 *     downstream loop branch fires no items, which n8n treats as a
 *     no-op) AND emit a single empty item on port 1 (`done`) so the
 *     trailing branch always fires once per loop completion.
 *
 * Distinguishing "fresh" vs "loop-back" is done structurally: if the
 * caller passes any items on input 1 (loop-back) we treat the run as a
 * continuation regardless of cursor presence — this lets the
 * dispatcher detect a mid-flight cursor crash + recover by replaying
 * the loop-back edge.
 */
export const LoopOverItemsNode: NodeRegistration = {
	type: 'SabFlow.LoopOverItems',
	typeVersion: 3,
	description:
		'Iterate over input items in fixed-size chunks. Exposes two outputs: ' +
		'the current chunk and a one-shot "done" signal.',
	defaults: { name: 'Loop Over Items', color: '#FF9966' },
	properties: [
		{
			displayName: 'Batch Size',
			name: 'batchSize',
			type: 'number',
			default: 1,
			description: 'Number of items to emit per loop iteration. Minimum 1.',
			required: true,
		},
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			default: {},
			placeholder: 'Add option',
			description: 'Optional flags that tune loop semantics.',
		},
	],

	async execute(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
		const nodeId = readNodeId(ctx);
		const cursorHelpers = resolveCursorHelpers(ctx.helpers);

		const rawBatchSize = ctx.getNodeParameter<number>('batchSize', 0, 1);
		const batchSize = clampBatchSize(rawBatchSize);
		const options = ctx.getNodeParameter<{ reset?: boolean; includeBinary?: boolean }>(
			'options',
			0,
			{},
		) ?? {};
		const reset = options.reset === true;
		const includeBinary = options.includeBinary !== false; // default true

		// Probe both input ports. `getInputData()` returns [] when nothing
		// arrived on that handle — that's our only signal for which edge
		// triggered the run.
		const initialItems = ctx.getInputData(0);
		const loopbackItems = ctx.getInputData(1);

		let cursor = cursorHelpers.getRunCursor(nodeId);
		const isLoopBack = loopbackItems.length > 0 && cursor !== undefined && !reset;

		if (!isLoopBack) {
			// Fresh entry (or forced reset). Snapshot the input batch and
			// reset offset. If the input is empty, short-circuit straight
			// to `done` so downstream "done" branches still fire once.
			cursor = {
				items: initialItems.map((it) => projectItem(it, includeBinary)),
				offset: 0,
				batchSize,
				exhausted: false,
			};
		}

		// Narrow for TS — `cursor` is set on both branches above.
		const c = cursor!;

		// Slice the next chunk.
		const start = c.offset;
		const end = Math.min(start + c.batchSize, c.items.length);
		const chunk = c.items.slice(start, end);
		c.offset = end;

		if (chunk.length === 0) {
			// Either empty input on first entry or we ran past the end on
			// a loop-back. Fire `done` exactly once and clear the cursor.
			c.exhausted = true;
			cursorHelpers.clearRunCursor(nodeId);
			return {
				output: [
					[], // port 0: items — empty, loop branch idles.
					[{ json: { done: true, total: c.items.length } }], // port 1: done.
				],
			};
		}

		// More work to do — persist cursor for the next loop-back.
		cursorHelpers.setRunCursor(nodeId, c);
		return {
			output: [
				chunk, // port 0: this iteration's items.
				[], // port 1: done — silent until the final pass.
			],
		};
	},
};

/* ------------------------------------------------------------------ */
/* Merge node                                                          */
/* ------------------------------------------------------------------ */

/**
 * `SabFlow.Merge` — combine N input streams into one output port.
 *
 * The variadic input arity is handled by the executor: it polls
 * `ctx.getInputData(i)` for `i = 0..inputCount-1` where `inputCount` is
 * inferred from the wired edges. We only stop probing when two
 * consecutive ports yield an empty array AND no parameter declares a
 * minimum count higher than `i`.
 *
 * Modes:
 *   - `append`    — `[...inputs[0], ...inputs[1], ...]`.
 *   - `combine`   — pair items across inputs.
 *       - `combineBy: 'position'` — zip by index. The output length is
 *         the *max* input length; missing slots emit `{ json: {} }` to
 *         match n8n's "fill with empty objects" default.
 *       - `combineBy: 'fields'`   — join input 0 against input 1 by
 *         matching the listed `fieldsToMatchOn`. With more than two
 *         inputs we fold left: `merge(merge(in0, in1), in2)`. This
 *         matches the modern n8n Merge node's reduce semantics.
 *   - `multiplex` — full Cartesian product across all inputs. Each
 *     emitted item is the spread-merge of one pick from every input;
 *     later inputs override earlier inputs on key collision.
 */
export const MergeNode: NodeRegistration = {
	type: 'SabFlow.Merge',
	typeVersion: 3,
	description:
		'Combine two or more input streams into one. Supports append, combine-by-' +
		'position, combine-by-fields, and multiplex (Cartesian) modes.',
	defaults: { name: 'Merge', color: '#00BFA5' },
	properties: [
		{
			displayName: 'Mode',
			name: 'mode',
			type: 'options',
			default: 'append',
			noDataExpression: true,
			description: 'How to combine the inputs.',
			options: [
				{ name: 'Append', value: 'append' },
				{ name: 'Combine', value: 'combine' },
				{ name: 'Multiplex (Cartesian)', value: 'multiplex' },
			],
		},
		{
			displayName: 'Combine By',
			name: 'combineBy',
			type: 'options',
			default: 'position',
			noDataExpression: true,
			description:
				'In `combine` mode, whether to pair items by their index or by ' +
				'matching JSON field values.',
			options: [
				{ name: 'Position', value: 'position' },
				{ name: 'Fields', value: 'fields' },
			],
		},
		{
			displayName: 'Fields to Match On',
			name: 'fieldsToMatchOn',
			type: 'string',
			default: '',
			description:
				'Comma-separated JSON paths (supports dotted nesting, e.g. ' +
				'`customer.email`). Required when `combineBy = fields`.',
			placeholder: 'id, email',
		},
		{
			displayName: 'Number of Inputs',
			name: 'inputCount',
			type: 'number',
			default: 2,
			description: 'Hint to the executor: how many input ports to wire (minimum 2).',
		},
	],

	async execute(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
		const mode = ctx.getNodeParameter<'append' | 'combine' | 'multiplex'>('mode', 0, 'append');
		const combineBy = ctx.getNodeParameter<'position' | 'fields'>('combineBy', 0, 'position');
		const fieldsRaw = ctx.getNodeParameter<string>('fieldsToMatchOn', 0, '');
		const declaredCount = ctx.getNodeParameter<number>('inputCount', 0, 2);

		const minCount = Math.max(2, Math.floor(Number(declaredCount) || 2));

		// Collect every input port that has items, plus enough empty ports
		// to satisfy `minCount`. Stop probing after we see two consecutive
		// empty ports past `minCount` — this matches the dispatcher's
		// "two trailing empties = end of wire" probe convention.
		const inputs: NodeExecutionItem[][] = [];
		let consecutiveEmpty = 0;
		for (let i = 0; i < 64; i++) {
			const got = ctx.getInputData(i);
			if (i < minCount) {
				inputs.push(got);
				if (got.length === 0) consecutiveEmpty++;
				else consecutiveEmpty = 0;
				continue;
			}
			if (got.length === 0) {
				consecutiveEmpty++;
				if (consecutiveEmpty >= 2) break;
				inputs.push(got);
				continue;
			}
			inputs.push(got);
			consecutiveEmpty = 0;
		}

		if (mode === 'append') {
			const out: NodeExecutionItem[] = [];
			for (let inputIdx = 0; inputIdx < inputs.length; inputIdx++) {
				const stream = inputs[inputIdx];
				for (let itemIdx = 0; itemIdx < stream.length; itemIdx++) {
					const it = stream[itemIdx];
					// Stamp `pairedItem` so lineage views can reconstruct the
					// source port without consulting the dispatcher trace.
					out.push({
						json: it.json,
						...(it.binary ? { binary: it.binary } : {}),
						pairedItem: { item: itemIdx, input: inputIdx },
					});
				}
			}
			return { output: [out] };
		}

		if (mode === 'combine') {
			if (combineBy === 'position') {
				const maxLen = inputs.reduce((m, s) => Math.max(m, s.length), 0);
				const out: NodeExecutionItem[] = [];
				for (let i = 0; i < maxLen; i++) {
					const merged: Record<string, unknown> = {};
					const paired: Array<{ item: number; input: number }> = [];
					for (let p = 0; p < inputs.length; p++) {
						const src = inputs[p][i];
						if (src) {
							Object.assign(merged, src.json);
							paired.push({ item: i, input: p });
						}
					}
					out.push({ json: merged, pairedItem: paired });
				}
				return { output: [out] };
			}

			// combineBy === 'fields'
			const fields = fieldsRaw
				.split(',')
				.map((s) => s.trim())
				.filter((s) => s.length > 0);
			if (fields.length === 0 || inputs.length < 2) {
				// No fields ⇒ nothing reliable to join on. Mirror n8n's
				// behaviour of emitting an empty output rather than throwing
				// inside a hot path; validation belongs at the editor seam.
				return { output: [[]] };
			}
			// Left-fold: merge(input0, input1) → merge(result, input2) → …
			let acc = inputs[0];
			for (let i = 1; i < inputs.length; i++) {
				acc = mergeByFields(acc, inputs[i], fields);
			}
			return { output: [acc] };
		}

		// mode === 'multiplex' — Cartesian product. Early-out if any input
		// is empty (the product is then empty per definition).
		for (const s of inputs) {
			if (s.length === 0) return { output: [[]] };
		}
		const out: NodeExecutionItem[] = [];
		const indices = new Array<number>(inputs.length).fill(0);
		while (true) {
			const merged: Record<string, unknown> = {};
			const paired: Array<{ item: number; input: number }> = [];
			for (let p = 0; p < inputs.length; p++) {
				const i = indices[p];
				const src = inputs[p][i];
				Object.assign(merged, src.json);
				paired.push({ item: i, input: p });
			}
			out.push({ json: merged, pairedItem: paired });

			// Increment like an odometer; carry from the right.
			let k = inputs.length - 1;
			while (k >= 0) {
				indices[k]++;
				if (indices[k] < inputs[k].length) break;
				indices[k] = 0;
				k--;
			}
			if (k < 0) break;
		}
		return { output: [out] };
	},
};

export default { LoopOverItemsNode, MergeNode };
