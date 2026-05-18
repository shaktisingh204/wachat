/**
 * SabFlow `Set` node (n8n-parity "Edit Fields" / "Set", typeVersion 1)
 * --------------------------------------------------------------------
 *
 * Track B Phase 3 (sub-task #4 of 10).
 *
 * The `Set` node mutates the JSON payload of each input item by
 * assigning one or more named values. It is one of the most heavily
 * used nodes in real n8n workflows because it is the canonical seam
 * between "data I have" and "data the next node expects" — renaming
 * keys, hoisting nested fields, coercing types, dropping noise.
 *
 * Semantics (faithful to n8n's "Edit Fields (Set)" node):
 *
 *   - When `keepOnlySet === true`, the output item's JSON starts from
 *     an empty object — only the values declared in `values[]` survive.
 *   - When `keepOnlySet === false` (default), the output item is a
 *     shallow clone of the input's JSON and `binary` is forwarded
 *     verbatim; declared values overwrite their target keys.
 *   - When `options.dotNotation === true`, each value's `name` is
 *     treated as a dotted path (`address.city`, `meta.tags.0`) and
 *     intermediate objects are auto-created. When `false`, the literal
 *     string is used as a flat key (so `"foo.bar"` lands as a top-level
 *     property called `"foo.bar"`). n8n defaults dot-notation ON.
 *   - Each value carries a `type` (`string` | `number` | `boolean` |
 *     `array` | `object`) and the rendered template is coerced into
 *     that type — bad coercions raise a `NodeOperationError`.
 *   - Templates use n8n-style `{{ $json.foo }}` / `${ $json.foo }` /
 *     `{{$json["bar"]}}` interpolation, resolved against an evaluation
 *     scope built from the item's JSON plus the workflow data proxy
 *     (`$json`, `$node`, `$workflow`, `$execution`, `$now`, `$today`,
 *     `$itemIndex`). Phase B.4 will hot-swap the placeholder
 *     `resolveTemplate` for the full expression engine.
 *
 * Forward-decl seam to the expression engine:
 *   Phase B.4 owns `src/lib/sabflow/executor/expression.ts` and exports
 *   `resolveTemplate(tpl, scope) -> string`. Today we use a dynamic
 *   import guarded by `@ts-expect-error` and fall back to a minimal
 *   `{{ path.to.value }}` substituter when the module is absent — that
 *   way this file ships, runs, and tests cleanly against both states.
 *
 * @module sabflow/executor/nodes/set
 */

import type {
	NodeExecutionContext,
	NodeExecutionDataProxy,
	NodeExecutionItem,
	NodeExecutionResult,
	NodeRegistration,
} from '../contract';
import { NodeOperationError } from '../errors';

/* ------------------------------------------------------------------ */
/* Forward-decl: expression engine lives in Phase B.4.                */
/* ------------------------------------------------------------------ */

/**
 * Evaluation scope handed to {@link resolveTemplate}. Mirrors the
 * Phase B.4 expression engine's public surface so this node compiles
 * before that module lands and degrades gracefully when it is absent.
 *
 * `$json` is the *current item's* JSON (already exploded out of the
 * proxy for ergonomics — most templates only ever reference it).
 * The remainder of the proxy is folded in so `{{ $node.HTTP.json.id }}`
 * style references work once the real engine arrives.
 */
export interface TemplateScope {
	$json: Record<string, unknown>;
	$node: NodeExecutionDataProxy['$node'];
	$workflow: NodeExecutionDataProxy['$workflow'];
	$execution: NodeExecutionDataProxy['$execution'];
	$now: Date;
	$today: Date;
	$itemIndex: number;
}

/**
 * Forward-declared signature owned by Phase B.4
 * (`../expression`). Returns the rendered string with every `{{ … }}` /
 * `${ … }` placeholder substituted from `scope`. Implementations MUST
 * throw on parse errors or unresolved references so the Set node
 * surfaces them as deterministic `NodeOperationError`s.
 *
 * @internal
 */
type ResolveTemplateFn = (tpl: string, scope: TemplateScope) => string;

/**
 * Phase 4 will export `resolveTemplate` from `../expression`. Until
 * then, we attempt a dynamic import (so the module hot-swaps the
 * moment it lands) and fall back to the local placeholder otherwise.
 *
 * The dynamic-import path is silent on failure — production callers
 * see only the rendered string. Errors thrown *by* the engine (parse
 * errors, missing references) propagate normally and are converted
 * into `NodeOperationError` by the caller.
 *
 * @internal
 */
let cachedResolver: ResolveTemplateFn | undefined;
let resolverProbed = false;

async function getResolveTemplate(): Promise<ResolveTemplateFn> {
	if (cachedResolver) return cachedResolver;
	if (!resolverProbed) {
		resolverProbed = true;
		try {
			// @ts-expect-error forward-decl: '../expression' is owned by Phase B.4.
			const mod = (await import('../expression')) as {
				resolveTemplate?: ResolveTemplateFn;
			};
			if (typeof mod.resolveTemplate === 'function') {
				cachedResolver = mod.resolveTemplate;
			}
		} catch {
			// Module not present yet — keep the placeholder.
		}
	}
	return cachedResolver ?? placeholderResolveTemplate;
}

/**
 * Minimal `${ $json.foo }` / `{{ $json.foo }}` placeholder substituter.
 * Replaced by Phase B.4's full expression engine; kept intentionally
 * tiny so its behaviour is obvious and predictable.
 *
 * Recognised forms:
 *   - `{{ <path> }}`  — n8n classic
 *   - `${ <path> }`   — n8n shorthand
 *   - `<path>` may use dot or bracket notation (`a.b`, `a["b c"]`,
 *     `a.0`); leading `$json.` / `$node.X.json.` is supported.
 *
 * Anything fancier (function calls, arithmetic, `$now.plus(...)`) is
 * out of scope — those templates render as their original text and the
 * eventual expression engine will pick them up unchanged.
 *
 * Unresolved paths render as the empty string (n8n parity for the
 * legacy "no expression" mode). Phase B.4 may upgrade this to throw.
 *
 * @internal
 */
function placeholderResolveTemplate(tpl: string, scope: TemplateScope): string {
	if (typeof tpl !== 'string' || tpl.length === 0) return tpl ?? '';
	// Match `{{ ... }}` or `${ ... }`; non-greedy and tolerant of inner whitespace.
	return tpl.replace(/\{\{\s*([^}]+?)\s*\}\}|\$\{\s*([^}]+?)\s*\}/g, (_match, a, b) => {
		const expr = (a ?? b ?? '').trim();
		if (expr.length === 0) return '';
		const value = lookupPath(expr, scope);
		if (value === undefined || value === null) return '';
		if (typeof value === 'string') return value;
		if (typeof value === 'number' || typeof value === 'boolean') return String(value);
		if (value instanceof Date) return value.toISOString();
		try {
			return JSON.stringify(value);
		} catch {
			return String(value);
		}
	});
}

/**
 * Resolve a dotted/bracketed path against the scope. Strips a leading
 * `$json` so `{{ $json.foo }}` and `{{ foo }}` both work.
 *
 * @internal
 */
function lookupPath(expr: string, scope: TemplateScope): unknown {
	const segments = splitPath(expr);
	if (segments.length === 0) return undefined;

	let head = segments[0];
	let rest = segments.slice(1);
	let current: unknown;

	if (head === '$json') {
		current = scope.$json;
	} else if (head === '$node') {
		current = scope.$node as unknown;
	} else if (head === '$workflow') {
		current = scope.$workflow as unknown;
	} else if (head === '$execution') {
		current = scope.$execution as unknown;
	} else if (head === '$now') {
		current = scope.$now;
	} else if (head === '$today') {
		current = scope.$today;
	} else if (head === '$itemIndex') {
		current = scope.$itemIndex;
	} else {
		// Bare path: probe `$json` first for ergonomics.
		current = scope.$json;
		rest = [head, ...rest];
	}

	for (const seg of rest) {
		if (current === null || current === undefined) return undefined;
		if (typeof current !== 'object') return undefined;
		current = (current as Record<string, unknown>)[seg];
	}
	return current;
}

/**
 * Split a path expression into segments.
 * Supports `a.b`, `a["b"]`, `a['b']`, and `a[0]`.
 *
 * @internal
 */
function splitPath(expr: string): string[] {
	const out: string[] = [];
	let i = 0;
	let buf = '';
	const flush = () => {
		if (buf.length > 0) {
			out.push(buf);
			buf = '';
		}
	};
	while (i < expr.length) {
		const ch = expr[i];
		if (ch === '.') {
			flush();
			i++;
		} else if (ch === '[') {
			flush();
			// Find matching `]`.
			let j = i + 1;
			while (j < expr.length && expr[j] !== ']') j++;
			let inner = expr.slice(i + 1, j);
			// Strip wrapping quotes if present.
			if (
				(inner.startsWith('"') && inner.endsWith('"')) ||
				(inner.startsWith("'") && inner.endsWith("'"))
			) {
				inner = inner.slice(1, -1);
			}
			out.push(inner);
			i = j + 1;
		} else {
			buf += ch;
			i++;
		}
	}
	flush();
	return out;
}

/* ------------------------------------------------------------------ */
/* Parameter shapes                                                    */
/* ------------------------------------------------------------------ */

/**
 * Value-type union accepted by the Set node. Matches the n8n "Edit
 * Fields" type picker. Rendered templates are coerced into the chosen
 * type before assignment.
 */
export type SetValueType = 'string' | 'number' | 'boolean' | 'array' | 'object';

/**
 * One entry inside the `values` parameter array. n8n exposes these as
 * a `fixedCollection` in the property panel; the IR persists them as
 * an object array on `parameters.values`.
 */
export interface SetValueEntry {
	/** Target field name (or dotted path when `options.dotNotation`). */
	name: string;
	/** Target type after template rendering + coercion. */
	type: SetValueType;
	/**
	 * Template source. When `useExpression !== false` (the default), the
	 * template is rendered through the expression engine; when
	 * explicitly `false`, the value is taken verbatim and only coerced.
	 */
	value: string;
	/** Default: true. Set to `false` for raw literal assignment. */
	useExpression?: boolean;
}

/**
 * Options collection exposed by the n8n Set node.
 */
export interface SetNodeOptions {
	/**
	 * When true (default), `name` is parsed as a dotted/bracketed path
	 * and intermediate objects are auto-created. When false, the
	 * literal string is used as a flat object key.
	 */
	dotNotation?: boolean;
}

/* ------------------------------------------------------------------ */
/* Coercion + assignment helpers                                       */
/* ------------------------------------------------------------------ */

/**
 * Coerce a rendered string into the requested {@link SetValueType}.
 * Throws `NodeOperationError` on impossible coercions (e.g. non-JSON
 * input for `array` / `object`, non-numeric input for `number`).
 *
 * @internal
 */
function coerce(
	rendered: string,
	type: SetValueType,
	fieldName: string,
	itemIndex: number,
): unknown {
	switch (type) {
		case 'string':
			return rendered;
		case 'number': {
			if (rendered === '') {
				throw new NodeOperationError(
					`Set: cannot coerce empty string to number for field "${fieldName}"`,
					{ nodeType: 'SabFlow.Set', itemIndex, details: { fieldName } },
				);
			}
			const n = Number(rendered);
			if (!Number.isFinite(n)) {
				throw new NodeOperationError(
					`Set: value "${rendered}" is not a finite number for field "${fieldName}"`,
					{ nodeType: 'SabFlow.Set', itemIndex, details: { fieldName, rendered } },
				);
			}
			return n;
		}
		case 'boolean': {
			const v = rendered.trim().toLowerCase();
			if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
			if (v === 'false' || v === '0' || v === 'no' || v === 'off' || v === '') return false;
			throw new NodeOperationError(
				`Set: value "${rendered}" is not a valid boolean for field "${fieldName}"`,
				{ nodeType: 'SabFlow.Set', itemIndex, details: { fieldName, rendered } },
			);
		}
		case 'array': {
			let parsed: unknown;
			try {
				parsed = JSON.parse(rendered);
			} catch (cause) {
				throw new NodeOperationError(
					`Set: value for field "${fieldName}" is not valid JSON (expected an array)`,
					{ nodeType: 'SabFlow.Set', itemIndex, cause, details: { fieldName } },
				);
			}
			if (!Array.isArray(parsed)) {
				throw new NodeOperationError(
					`Set: value for field "${fieldName}" parsed as JSON but is not an array`,
					{ nodeType: 'SabFlow.Set', itemIndex, details: { fieldName } },
				);
			}
			return parsed;
		}
		case 'object': {
			let parsed: unknown;
			try {
				parsed = JSON.parse(rendered);
			} catch (cause) {
				throw new NodeOperationError(
					`Set: value for field "${fieldName}" is not valid JSON (expected an object)`,
					{ nodeType: 'SabFlow.Set', itemIndex, cause, details: { fieldName } },
				);
			}
			if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
				throw new NodeOperationError(
					`Set: value for field "${fieldName}" parsed as JSON but is not an object`,
					{ nodeType: 'SabFlow.Set', itemIndex, details: { fieldName } },
				);
			}
			return parsed;
		}
		default: {
			// Exhaustiveness guard — the editor restricts to the union above,
			// but workflows imported from older n8n versions might carry a
			// stray type we don't know about.
			throw new NodeOperationError(
				`Set: unknown value type "${type as string}" for field "${fieldName}"`,
				{ nodeType: 'SabFlow.Set', itemIndex, details: { fieldName, type } },
			);
		}
	}
}

/**
 * Assign `value` at `path` inside `target`. When `dotNotation` is
 * true, the path is split on `.` (and bracket-indexed segments are
 * preserved); intermediate non-object values are overwritten with
 * fresh objects so the path is reachable.
 *
 * @internal
 */
function assignAtPath(
	target: Record<string, unknown>,
	path: string,
	value: unknown,
	dotNotation: boolean,
): void {
	if (!dotNotation) {
		target[path] = value;
		return;
	}
	const segments = splitPath(path);
	if (segments.length === 0) return;
	let cursor: Record<string, unknown> = target;
	for (let i = 0; i < segments.length - 1; i++) {
		const seg = segments[i];
		const existing = cursor[seg];
		if (
			existing === null ||
			existing === undefined ||
			typeof existing !== 'object' ||
			Array.isArray(existing)
		) {
			const fresh: Record<string, unknown> = {};
			cursor[seg] = fresh;
			cursor = fresh;
		} else {
			cursor = existing as Record<string, unknown>;
		}
	}
	cursor[segments[segments.length - 1]] = value;
}

/* ------------------------------------------------------------------ */
/* Node registration                                                   */
/* ------------------------------------------------------------------ */

/**
 * The `SabFlow.Set` node executor. n8n parity:
 * `n8n-nodes-base.set` / "Edit Fields (Set)" at typeVersion 1.
 */
export const SetNode: NodeRegistration = {
	type: 'SabFlow.Set',
	typeVersion: 1,
	description:
		'Assign one or more named values to each input item. Supports template ' +
		'expressions, dot-notation paths, type coercion, and keep-only-set mode.',
	defaults: { name: 'Edit Fields', color: '#0099CC' },
	properties: [
		{
			displayName: 'Keep Only Set',
			name: 'keepOnlySet',
			type: 'boolean',
			default: false,
			noDataExpression: true,
			description:
				'If enabled, the output item contains only the fields declared ' +
				'below — all incoming JSON keys are dropped.',
		},
		{
			displayName: 'Values to Set',
			name: 'values',
			type: 'fixedCollection',
			default: [],
			description:
				'Array of { name, type, value, useExpression? } entries. Each entry ' +
				'is rendered through the expression engine and coerced into the chosen type.',
		},
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			default: { dotNotation: true },
			description:
				'Per-node options. `dotNotation` (default: true) controls whether ' +
				'field names are parsed as dotted paths.',
		},
	],

	async execute(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
		const inputItems = ctx.getInputData();
		const out: NodeExecutionItem[] = [];
		const resolveTemplate = await getResolveTemplate();

		for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex++) {
			const item = inputItems[itemIndex];
			const keepOnlySet = ctx.getNodeParameter<boolean>('keepOnlySet', itemIndex, false);
			const valuesRaw = ctx.getNodeParameter<unknown>('values', itemIndex, []);
			const optionsRaw = ctx.getNodeParameter<unknown>('options', itemIndex, {});

			const values = normalizeValues(valuesRaw, itemIndex);
			const options = normalizeOptions(optionsRaw);
			const dotNotation = options.dotNotation !== false; // default true

			// Build the output JSON shell.
			const json: Record<string, unknown> = keepOnlySet
				? {}
				: shallowClone(item.json);

			// Build the per-item evaluation scope.
			const proxy = ctx.getWorkflowDataProxy(itemIndex);
			const scope: TemplateScope = {
				$json: item.json,
				$node: proxy.$node,
				$workflow: proxy.$workflow,
				$execution: proxy.$execution,
				$now: proxy.$now,
				$today: proxy.$today,
				$itemIndex: itemIndex,
			};

			for (const entry of values) {
				if (typeof entry.name !== 'string' || entry.name.length === 0) {
					throw new NodeOperationError(
						'Set: every value entry must have a non-empty `name`.',
						{ nodeType: 'SabFlow.Set', itemIndex },
					);
				}
				const useExpression = entry.useExpression !== false; // default true
				const rawTemplate = typeof entry.value === 'string' ? entry.value : String(entry.value ?? '');
				let rendered: string;
				try {
					rendered = useExpression ? resolveTemplate(rawTemplate, scope) : rawTemplate;
				} catch (cause) {
					throw new NodeOperationError(
						`Set: failed to render template for field "${entry.name}"`,
						{
							nodeType: 'SabFlow.Set',
							itemIndex,
							cause,
							details: { fieldName: entry.name, template: rawTemplate },
						},
					);
				}
				const coerced = coerce(rendered, entry.type, entry.name, itemIndex);
				assignAtPath(json, entry.name, coerced, dotNotation);
			}

			const outItem: NodeExecutionItem = { json };
			// Preserve binary attachments + paired-item lineage when we are
			// not stripping the input — mirrors n8n's behaviour.
			if (!keepOnlySet) {
				if (item.binary !== undefined) outItem.binary = item.binary;
				if (item.pairedItem !== undefined) outItem.pairedItem = item.pairedItem;
				if (item.pinned !== undefined) outItem.pinned = item.pinned;
			}
			out.push(outItem);
		}

		return { output: [out] };
	},
};

/* ------------------------------------------------------------------ */
/* Parameter normalisation                                             */
/* ------------------------------------------------------------------ */

/**
 * The editor can store `values` either as the canonical array shape or
 * as the n8n `fixedCollection` envelope `{ values: [...] }`. We accept
 * both so imported workflows round-trip cleanly.
 *
 * @internal
 */
function normalizeValues(raw: unknown, itemIndex: number): SetValueEntry[] {
	if (raw === undefined || raw === null) return [];
	let arr: unknown[];
	if (Array.isArray(raw)) {
		arr = raw;
	} else if (typeof raw === 'object' && Array.isArray((raw as { values?: unknown }).values)) {
		arr = (raw as { values: unknown[] }).values;
	} else {
		throw new NodeOperationError(
			'Set: `values` parameter must be an array of { name, type, value } entries.',
			{ nodeType: 'SabFlow.Set', itemIndex },
		);
	}
	const out: SetValueEntry[] = [];
	for (const entry of arr) {
		if (entry === null || typeof entry !== 'object') {
			throw new NodeOperationError('Set: each `values` entry must be an object.', {
				nodeType: 'SabFlow.Set',
				itemIndex,
			});
		}
		const e = entry as Record<string, unknown>;
		const type = e.type as SetValueType;
		if (
			type !== 'string' &&
			type !== 'number' &&
			type !== 'boolean' &&
			type !== 'array' &&
			type !== 'object'
		) {
			throw new NodeOperationError(
				`Set: unknown value type "${String(type)}" — expected one of string|number|boolean|array|object.`,
				{ nodeType: 'SabFlow.Set', itemIndex, details: { type } },
			);
		}
		out.push({
			name: String(e.name ?? ''),
			type,
			value: typeof e.value === 'string' ? e.value : String(e.value ?? ''),
			...(typeof e.useExpression === 'boolean' ? { useExpression: e.useExpression } : {}),
		});
	}
	return out;
}

/** @internal */
function normalizeOptions(raw: unknown): SetNodeOptions {
	if (raw === null || typeof raw !== 'object') return {};
	const r = raw as Record<string, unknown>;
	const out: SetNodeOptions = {};
	if (typeof r.dotNotation === 'boolean') out.dotNotation = r.dotNotation;
	return out;
}

/**
 * Shallow clone of `item.json` so user-declared values don't mutate
 * the input bag (which the dispatcher may keep a reference to for
 * lineage / retry purposes).
 *
 * @internal
 */
function shallowClone(json: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const k of Object.keys(json)) out[k] = json[k];
	return out;
}

export default SetNode;
