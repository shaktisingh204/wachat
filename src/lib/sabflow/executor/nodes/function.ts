/**
 * SabFlow Executor — Function node (`SabFlow.Function`, typeVersion 2).
 *
 * Track B Phase 3 (sub-task #8 of 10).
 *
 * Lets workflow authors run arbitrary JavaScript over the batch of items
 * flowing into the node. Equivalent to n8n's Function node (the legacy,
 * batch-style one — not "Function Item"). Output MUST be an array of
 * `{ json: {...} }` entries; the dispatcher then emits them on port 0.
 *
 * --- Sandboxing ---
 * Execution happens inside a {@link https://github.com/justjake/quickjs-emscripten | QuickJS}
 * WASM VM, not `vm` / `node:vm`. This gives us:
 *   - hard memory cap (64 MiB) we can ENFORCE (not just suggest),
 *   - hard interrupt handler we can poll for wall-clock timeouts,
 *   - zero host access by default — no `require`, no `process`, no `fetch`,
 *     no FS, no network. The sandbox only sees what we marshal in.
 *
 * The `quickjs-emscripten` dep is loaded lazily via dynamic import so that
 * other executor nodes (which don't need QuickJS) don't pay the WASM cost
 * on startup. **NEEDED root-package.json dep**: `quickjs-emscripten`
 * (^0.31.x at time of writing; sibling Phase 8 may swap to `isolated-vm`).
 *
 * --- Scope handed to user code ---
 *   items        — `NodeExecutionItem[]` for the primary input port,
 *   $json        — shorthand for `items[0]?.json ?? {}`,
 *   $node        — upstream nodes (proxy from item 0),
 *   $now         — Date captured at execute() start,
 *   $workflow    — { id, name, active },
 *   helpers      — { log(msg, meta?) } — proxies to ctx.logger.info.
 *
 * --- Error mapping ---
 *   compile fail  → NodeOperationError, code FUNCTION_COMPILE
 *   runtime throw → NodeApiError,       code FUNCTION_RUNTIME
 *   >5s wall      → ExecutionTimeoutError (scope=node, timeoutMs=5000)
 *   >64 MiB       → ResourceLimitError   (resource=memory, kind=transient)
 *   bad return    → NodeOperationError, code FUNCTION_RETURN_SHAPE
 */

import type {
	NodeExecutionContext,
	NodeExecutionItem,
	NodeExecutionResult,
	NodeRegistration,
} from '../contract';
import {
	ExecutionTimeoutError,
	NodeApiError,
	NodeOperationError,
	ResourceLimitError,
} from '../errors';

/** Hard wall-clock budget for one Function-node invocation. */
const EXECUTION_TIMEOUT_MS = 5_000;

/** Hard memory cap inside the QuickJS VM. 64 MiB matches the spec. */
const MEMORY_LIMIT_BYTES = 64 * 1024 * 1024;

/** How often the interrupt handler is polled. Cheap; QuickJS calls it. */
const INTERRUPT_POLL_BUDGET = 1024;

/** Supported `language` values for {@link FunctionNode}. */
type FunctionLanguage = 'javascript';

/**
 * Minimal structural typing of the bits of `quickjs-emscripten` we touch.
 * Imported via `await import(...)` so missing-dep failures are caught
 * at execute time (not at module-load time).
 */
interface QuickJSModuleHandle {
	dispose(): void;
	consume<T>(fn: (handle: unknown) => T): T;
}
interface QuickJSContext {
	global: QuickJSModuleHandle;
	undefined: QuickJSModuleHandle;
	null: QuickJSModuleHandle;
	newString(s: string): QuickJSModuleHandle;
	newNumber(n: number): QuickJSModuleHandle;
	newObject(): QuickJSModuleHandle;
	newArray(): QuickJSModuleHandle;
	newFunction(name: string, fn: (...args: unknown[]) => unknown): QuickJSModuleHandle;
	setProp(target: QuickJSModuleHandle, key: string, value: QuickJSModuleHandle): void;
	getProp(target: QuickJSModuleHandle, key: string): QuickJSModuleHandle;
	evalCode(
		code: string,
		filename?: string,
	):
		| { value: QuickJSModuleHandle; error?: undefined }
		| { error: QuickJSModuleHandle; value?: undefined };
	dump(handle: QuickJSModuleHandle): unknown;
	runtime: QuickJSRuntime;
	dispose(): void;
}
interface QuickJSRuntime {
	setMemoryLimit(bytes: number): void;
	setMaxStackSize(bytes: number): void;
	setInterruptHandler(handler: () => boolean): void;
	dispose(): void;
}
interface QuickJSVMFactory {
	newRuntime(): QuickJSRuntime;
	newContext(): QuickJSContext;
}

/**
 * Marshal a host JS value into the QuickJS VM. Only plain JSON-ish values
 * cross the boundary — functions, symbols, prototypes, anything else
 * becomes `undefined` inside the sandbox.
 *
 * @internal
 */
function marshalIn(vm: QuickJSContext, value: unknown): QuickJSModuleHandle {
	if (value === null) return vm.null;
	if (value === undefined) return vm.undefined;
	if (typeof value === 'string') return vm.newString(value);
	if (typeof value === 'number') return vm.newNumber(value);
	if (typeof value === 'boolean') return vm.newNumber(value ? 1 : 0);
	if (value instanceof Date) return vm.newString(value.toISOString());
	if (Array.isArray(value)) {
		const arr = vm.newArray();
		for (let i = 0; i < value.length; i++) {
			vm.setProp(arr, String(i), marshalIn(vm, value[i]));
		}
		return arr;
	}
	if (typeof value === 'object') {
		const obj = vm.newObject();
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			vm.setProp(obj, k, marshalIn(vm, v));
		}
		return obj;
	}
	return vm.undefined;
}

/**
 * `SabFlow.Function` node — runs user-authored JS over the input batch.
 */
export const FunctionNode: NodeRegistration = {
	type: 'SabFlow.Function',
	typeVersion: 2,
	description:
		'Run a small JavaScript snippet over the entire input batch. Return an items array `[{ json: {...} }]`.',
	defaults: {
		name: 'Function',
		color: '#FF9920',
	},
	properties: [
		{
			displayName: 'Language',
			name: 'language',
			type: 'options',
			default: 'javascript',
			description: 'Scripting language for the function body (only JavaScript is supported today).',
			noDataExpression: true,
			options: [{ name: 'JavaScript', value: 'javascript' }],
		},
		{
			displayName: 'Function Code',
			name: 'functionCode',
			type: 'string',
			default:
				"// Available: items, $json, $node, $now, $workflow, helpers.log\nreturn items;",
			description:
				'JavaScript executed inside a sandboxed VM. MUST return an array of `{ json: {...} }` items.',
			noDataExpression: true,
			placeholder: 'return items.map(i => ({ json: { ...i.json, extra: 1 } }));',
		},
	],

	async execute(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
		// ---- 1. Pull params -----------------------------------------------
		const items = ctx.getInputData(0);
		const language = ctx.getNodeParameter<FunctionLanguage>('language', 0, 'javascript');
		const functionCode = ctx.getNodeParameter<string>('functionCode', 0, '');

		if (language !== 'javascript') {
			throw new NodeOperationError(`Unsupported language "${language}"`, {
				nodeType: 'SabFlow.Function',
				details: { paramName: 'language', supported: ['javascript'] },
			});
		}
		if (typeof functionCode !== 'string' || functionCode.trim().length === 0) {
			throw new NodeOperationError('Function Code is required', {
				nodeType: 'SabFlow.Function',
				details: { paramName: 'functionCode' },
			});
		}

		// ---- 2. Lazy-load quickjs-emscripten -------------------------------
		let mod: unknown;
		try {
			// quickjs-emscripten is declared as a NEEDED root-package.json
			// dep (see file header). Until it is installed, the dynamic
			// import resolves to `undefined` and we throw a clear error.
			// @ts-expect-error — optional peer dep, types resolve once installed.
			mod = await import('quickjs-emscripten');
		} catch (cause) {
			throw new NodeOperationError(
				'quickjs-emscripten is not installed — add it to the workspace root package.json',
				{
					nodeType: 'SabFlow.Function',
					cause,
					details: { dependency: 'quickjs-emscripten' },
				},
			);
		}

		// `getQuickJS()` returns the WASM-backed factory. Different package
		// versions export it slightly differently; we try the documented
		// names in order.
		const factory: QuickJSVMFactory | undefined = await (async () => {
			const m = mod as Record<string, unknown>;
			if (typeof m.getQuickJS === 'function') {
				return (await (m.getQuickJS as () => Promise<QuickJSVMFactory>)()) as QuickJSVMFactory;
			}
			if (typeof m.newQuickJSWASMModule === 'function') {
				return (await (m.newQuickJSWASMModule as () => Promise<QuickJSVMFactory>)()) as QuickJSVMFactory;
			}
			if (m.QuickJS) return m.QuickJS as QuickJSVMFactory;
			return undefined;
		})();

		if (!factory) {
			throw new NodeOperationError(
				'quickjs-emscripten loaded but no QuickJS factory export was found',
				{ nodeType: 'SabFlow.Function', details: { dependency: 'quickjs-emscripten' } },
			);
		}

		// ---- 3. Boot the VM with hard caps --------------------------------
		const runtime = factory.newRuntime();
		runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
		// 1 MiB stack — plenty for user snippets, refuses runaway recursion.
		runtime.setMaxStackSize(1 * 1024 * 1024);

		const startedAt = Date.now();
		let timedOut = false;
		// Interrupt handler is called by QuickJS every `INTERRUPT_POLL_BUDGET`
		// bytecode ops. Returning true aborts the running snippet.
		runtime.setInterruptHandler(() => {
			if (Date.now() - startedAt >= EXECUTION_TIMEOUT_MS) {
				timedOut = true;
				return true;
			}
			return false;
		});

		// Belt-and-braces: also poll wall clock from the host so a snippet
		// that never yields to the interrupt handler (e.g. tight WASM-bound
		// loop) still gets killed. `setInterval` ticks while we await
		// `evalCode`; on Node it does *not* block JS execution because
		// evalCode is synchronous, but the WASM call is interruptible.
		const wallClockPoll = setInterval(() => {
			if (Date.now() - startedAt >= EXECUTION_TIMEOUT_MS) {
				timedOut = true;
			}
		}, Math.max(50, INTERRUPT_POLL_BUDGET / 16));

		const vm = factory.newContext();

		try {
			// ---- 4. Build the sandbox scope --------------------------------
			const $json = items[0]?.json ?? {};
			const proxy = ctx.getWorkflowDataProxy(0);

			vm.setProp(vm.global, 'items', marshalIn(vm, items as unknown as unknown[]));
			vm.setProp(vm.global, '$json', marshalIn(vm, $json));
			vm.setProp(vm.global, '$node', marshalIn(vm, proxy.$node as Record<string, unknown>));
			vm.setProp(vm.global, '$now', marshalIn(vm, proxy.$now));
			vm.setProp(vm.global, '$workflow', marshalIn(vm, proxy.$workflow));

			// helpers.log — pipe into the executor logger. We DO NOT expose
			// any other helper (no httpRequest, no SabFiles); the Function
			// node must stay deterministic and side-effect-free.
			const helpers = vm.newObject();
			const logFn = vm.newFunction('log', (...args: unknown[]) => {
				try {
					const msg = String(vm.dump(args[0] as QuickJSModuleHandle) ?? '');
					const meta = args[1] ? (vm.dump(args[1] as QuickJSModuleHandle) as Record<string, unknown>) : undefined;
					ctx.logger.info(`[Function] ${msg}`, meta);
				} catch {
					// swallow — logging must never throw out of the sandbox.
				}
				return vm.undefined;
			});
			vm.setProp(helpers, 'log', logFn);
			vm.setProp(vm.global, 'helpers', helpers);

			// ---- 5. Compile + execute --------------------------------------
			// Wrap in an IIFE so the user can `return` from the top level.
			const wrapped = `(function userFn() {\n${functionCode}\n})()`;

			let evalResult: ReturnType<QuickJSContext['evalCode']>;
			try {
				evalResult = vm.evalCode(wrapped, 'sabflow-function.js');
			} catch (cause) {
				// QuickJS shouldn't throw on the host side — but if it does
				// (e.g. malformed WASM call), surface as a compile error.
				// The wire-level `code` is fixed by the subclass to
				// NODE_OPERATION; the sub-code lives under `details.code`.
				throw new NodeOperationError('Failed to compile Function code', {
					nodeType: 'SabFlow.Function',
					cause,
					details: { code: 'FUNCTION_COMPILE' },
				});
			}

			// Distinguish compile vs runtime via timing: QuickJS reports
			// both as `error`. We classify by the message — parse errors
			// have SyntaxError-style messages.
			if (evalResult.error) {
				const dumped = vm.dump(evalResult.error) as
					| { name?: string; message?: string; stack?: string }
					| string
					| undefined;
				evalResult.error.dispose();

				if (timedOut) {
					throw new ExecutionTimeoutError(
						`Function exceeded ${EXECUTION_TIMEOUT_MS}ms wall-clock budget`,
						{
							scope: 'node',
							nodeType: 'SabFlow.Function',
							timeoutMs: EXECUTION_TIMEOUT_MS,
							elapsedMs: Date.now() - startedAt,
						},
					);
				}

				const errMsg = typeof dumped === 'string' ? dumped : dumped?.message ?? 'unknown sandbox error';
				const errName = typeof dumped === 'object' && dumped ? dumped.name : undefined;
				const errStack = typeof dumped === 'object' && dumped ? dumped.stack : undefined;

				// Memory pressure surfaces as a specific QuickJS message.
				if (/out of memory/i.test(errMsg)) {
					throw new ResourceLimitError(`Function exceeded ${MEMORY_LIMIT_BYTES} byte memory cap`, {
						resource: 'memory',
						kind: 'transient',
						limit: MEMORY_LIMIT_BYTES,
						nodeType: 'SabFlow.Function',
					});
				}

				if (errName === 'SyntaxError' || /SyntaxError|unexpected token/i.test(errMsg)) {
					throw new NodeOperationError(`Function failed to compile: ${errMsg}`, {
						nodeType: 'SabFlow.Function',
						details: { code: 'FUNCTION_COMPILE', stack: errStack },
					});
				}

				throw new NodeApiError(`Function threw at runtime: ${errMsg}`, {
					nodeType: 'SabFlow.Function',
					retryable: false,
					details: { code: 'FUNCTION_RUNTIME', stack: errStack, errorName: errName },
				});
			}

			// ---- 6. Dump return value back to host -------------------------
			const returned = vm.dump(evalResult.value) as unknown;
			evalResult.value.dispose();

			// Final timeout check — interrupt may have fired late.
			if (timedOut) {
				throw new ExecutionTimeoutError(
					`Function exceeded ${EXECUTION_TIMEOUT_MS}ms wall-clock budget`,
					{
						scope: 'node',
						nodeType: 'SabFlow.Function',
						timeoutMs: EXECUTION_TIMEOUT_MS,
						elapsedMs: Date.now() - startedAt,
					},
				);
			}

			// ---- 7. Validate shape -----------------------------------------
			if (!Array.isArray(returned)) {
				throw new NodeOperationError(
					'Function must return an array of items, e.g. `[{ json: { ... } }]`',
					{
						nodeType: 'SabFlow.Function',
						details: { code: 'FUNCTION_RETURN_SHAPE', received: typeof returned },
					},
				);
			}

			const out: NodeExecutionItem[] = returned.map((entry, idx) => {
				if (entry === null || typeof entry !== 'object') {
					throw new NodeOperationError(
						`Function return entry #${idx} must be an object with a "json" field`,
						{
							nodeType: 'SabFlow.Function',
							itemIndex: idx,
							details: { code: 'FUNCTION_RETURN_SHAPE' },
						},
					);
				}
				const record = entry as Record<string, unknown>;
				const json = record.json;
				if (json === null || typeof json !== 'object' || Array.isArray(json)) {
					throw new NodeOperationError(
						`Function return entry #${idx} is missing a "json" object`,
						{
							nodeType: 'SabFlow.Function',
							itemIndex: idx,
							details: { code: 'FUNCTION_RETURN_SHAPE' },
						},
					);
				}
				return { json: json as Record<string, unknown> };
			});

			return { output: [out] };
		} finally {
			clearInterval(wallClockPoll);
			try {
				vm.dispose();
			} catch {
				/* ignore double-dispose */
			}
			try {
				runtime.dispose();
			} catch {
				/* ignore */
			}
		}
	},
};

export default FunctionNode;
