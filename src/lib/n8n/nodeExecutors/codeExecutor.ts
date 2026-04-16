/**
 * Code executor — evaluates user-provided JavaScript inside a restricted
 * sandbox using the Node.js `vm` module.
 *
 * The sandbox exposes:
 *   $input   — { all(): items[], first(): item, last(): item, item: items[0] }
 *   $json    — shorthand for $input.item
 *   $vars    — context.variables (read-only proxy)
 *   $node    — nodeOutputs accessor
 *   console  — { log, warn, error } (captured but not printed in prod)
 *   items    — raw inputItems array (for legacy scripts)
 *
 * The code must return an array of items OR set `return items` at the top
 * level.  A plain object return is wrapped in an array automatically.
 *
 * Parameters:
 *   jsCode       – JavaScript source string
 *   mode         – 'runOnceForAllItems' | 'runOnceForEachItem'  (default: runOnceForAllItems)
 *   language     – 'javaScript' (only JS is supported here)
 */

import vm from 'vm';
import type { N8NNode, ExecutionContext, NodeExecutorResult } from '../types';

const EXECUTION_TIMEOUT_MS = 5_000;

function buildSandbox(
  items: Record<string, unknown>[],
  context: ExecutionContext,
  currentItem: Record<string, unknown>
): vm.Context {
  const logs: unknown[][] = [];

  const $input = {
    all: () => items,
    first: () => items[0] ?? {},
    last: () => items[items.length - 1] ?? {},
    item: currentItem,
  };

  const sandbox = {
    $input,
    $json: currentItem,
    items,
    $vars: context.variables,
    $node: new Proxy(context.nodeOutputs, {
      get(target, prop: string) {
        return {
          json: target[prop]?.[0] ?? {},
          all: () => target[prop] ?? [],
        };
      },
    }),
    console: {
      log: (...args: unknown[]) => logs.push(args),
      warn: (...args: unknown[]) => logs.push(args),
      error: (...args: unknown[]) => logs.push(args),
    },
    _logs: logs,
    // Allow JSON helpers
    JSON,
    Date,
    Math,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
  };

  return vm.createContext(sandbox);
}

function normaliseResult(raw: unknown, fallback: Record<string, unknown>[]): Record<string, unknown>[] {
  if (raw === undefined || raw === null) return fallback;
  if (Array.isArray(raw)) {
    return raw.map((item) =>
      item !== null && typeof item === 'object' ? (item as Record<string, unknown>) : { value: item }
    );
  }
  if (typeof raw === 'object') return [raw as Record<string, unknown>];
  return [{ value: raw }];
}

export async function executeCode(
  node: N8NNode,
  inputItems: Record<string, unknown>[],
  context: ExecutionContext
): Promise<NodeExecutorResult> {
  const params = node.parameters;
  const jsCode = (params.jsCode as string | undefined) ?? (params.code as string | undefined) ?? '';
  if (!jsCode.trim()) {
    return { items: inputItems.length > 0 ? inputItems : [{}] };
  }

  const mode = (params.mode as string) ?? 'runOnceForAllItems';
  const items = inputItems.length > 0 ? inputItems : [{}];

  // Wrap code so it always returns a value
  const wrappedCode = `(async function() { ${jsCode} })()`;

  if (mode === 'runOnceForEachItem') {
    const outputItems: Record<string, unknown>[] = [];

    for (const item of items) {
      const ctx = buildSandbox(items, context, item);
      try {
        const script = new vm.Script(wrappedCode);
        const result = await script.runInContext(ctx, { timeout: EXECUTION_TIMEOUT_MS });
        outputItems.push(...normaliseResult(result, [item]));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { items: [], error: `Code node error: ${msg}` };
      }
    }

    return { items: outputItems };
  }

  // runOnceForAllItems
  const ctx = buildSandbox(items, context, items[0] ?? {});
  try {
    const script = new vm.Script(wrappedCode);
    const result = await script.runInContext(ctx, { timeout: EXECUTION_TIMEOUT_MS });
    return { items: normaliseResult(result, items) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { items: [], error: `Code node error: ${msg}` };
  }
}
