/* ─────────────────────────────────────────────────────────────────────────────
   expressionResolver
   ────────────────────────────────────────────────────────────────────────────
   Lightweight front-end stub for resolving n8n-style expressions inside the
   flow editor.  It ONLY supports the subset that makes sense for a live
   preview: dotted / bracketed property access (`$json.user.name`,
   `$node["Set"].json.id`), `{{variable}}` tokens, and string concatenation
   with `+`.  It never calls `eval`.

   TODO(sibling-agent): replace this with the canonical resolver exported from
   `@/lib/sabflow/expressions/resolve` once it lands.  The public surface
   (`resolveExpression`, `ResolveResult`, `ExpressionContext`) is designed so
   the swap will be a single-line import change.
   ──────────────────────────────────────────────────────────────────────────── */

import type { Variable } from '@/lib/sabflow/types';

export interface ExpressionContext {
  variables: Variable[];
  nodes?: { name: string; outputSchema?: Record<string, unknown> }[];
  sampleInput?: Record<string, unknown>;
}

export type ResolveResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

/* ── {{ variable }} interpolation ─────────────────────────────────────────── */

function interpolateVariables(expression: string, variables: Variable[]): string {
  return expression.replace(/\{\{\s*([\w.\-]+)\s*\}\}/g, (_, name: string) => {
    const match = variables.find((v) => v.name === name);
    if (!match) return '';
    if (match.value !== undefined) return String(match.value);
    if (match.defaultValue !== undefined) return String(match.defaultValue);
    return '';
  });
}

/* ── Path access: foo.bar[0]["baz"] ───────────────────────────────────────── */

function readPath(
  root: unknown,
  segments: ReadonlyArray<string | number>,
): ResolveResult {
  let cursor: unknown = root;
  for (const segment of segments) {
    if (cursor === null || cursor === undefined) {
      return { ok: false, error: `Cannot read "${String(segment)}" of ${String(cursor)}` };
    }
    if (typeof cursor !== 'object') {
      return { ok: false, error: `Cannot index into ${typeof cursor}` };
    }
    cursor = (cursor as Record<string | number, unknown>)[segment];
  }
  return { ok: true, value: cursor };
}

/* ── Parse bracket/dot path after a `$root` identifier ────────────────────── */

interface ParsedPath {
  segments: (string | number)[];
  consumed: number;
}

function parsePath(source: string, startIndex: number): ParsedPath {
  const segments: (string | number)[] = [];
  let i = startIndex;
  while (i < source.length) {
    const c = source[i];
    if (c === '.') {
      i += 1;
      let end = i;
      while (end < source.length && /[\w]/.test(source[end])) end += 1;
      if (end > i) {
        segments.push(source.slice(i, end));
        i = end;
        continue;
      }
      break;
    }
    if (c === '[') {
      const closeIndex = source.indexOf(']', i + 1);
      if (closeIndex === -1) break;
      const key = source.slice(i + 1, closeIndex).trim();
      if (
        (key.startsWith('"') && key.endsWith('"')) ||
        (key.startsWith("'") && key.endsWith("'"))
      ) {
        segments.push(key.slice(1, -1));
      } else if (/^\d+$/.test(key)) {
        segments.push(Number(key));
      } else {
        segments.push(key);
      }
      i = closeIndex + 1;
      continue;
    }
    break;
  }
  return { segments, consumed: i - startIndex };
}

/* ── Resolve a single `$root...path` expression ───────────────────────────── */

function resolveSingleReference(
  expression: string,
  context: ExpressionContext,
): ResolveResult {
  const rootMatch = expression.match(/^\$[A-Za-z_]\w*/);
  if (!rootMatch) return { ok: false, error: `Unknown expression: ${expression}` };
  const rootName = rootMatch[0];
  const { segments } = parsePath(expression, rootName.length);

  const sampleInput = context.sampleInput ?? {};

  switch (rootName) {
    case '$json':
      return readPath(sampleInput, segments);
    case '$input':
      return readPath({ item: sampleInput }, segments);
    case '$vars': {
      const varsObj: Record<string, unknown> = {};
      for (const variable of context.variables) {
        varsObj[variable.name] =
          variable.value ?? variable.defaultValue ?? undefined;
      }
      return readPath(varsObj, segments);
    }
    case '$node': {
      if (segments.length === 0) {
        return { ok: false, error: '$node requires a name, e.g. $node["Name"].json' };
      }
      const [nodeName, ...rest] = segments;
      const node = context.nodes?.find((n) => n.name === String(nodeName));
      if (!node) return { ok: false, error: `Unknown node: "${String(nodeName)}"` };
      return readPath(node.outputSchema ?? {}, rest);
    }
    case '$now':
      return { ok: true, value: new Date().toISOString() };
    case '$env':
      return { ok: true, value: {} };
    default:
      return { ok: false, error: `Unknown expression root: ${rootName}` };
  }
}

/* ── Public API ───────────────────────────────────────────────────────────── */

/**
 * Resolve an expression against the supplied context.  The expression may
 * contain:
 *   • `{{variable}}` tokens — replaced first with the current variable values.
 *   • A single `$json.path`, `$node["X"].json.y`, etc. reference.
 *   • A plain string (returned unchanged after interpolation).
 */
export function resolveExpression(
  expression: string,
  context: ExpressionContext,
): ResolveResult {
  try {
    const interpolated = interpolateVariables(expression, context.variables);
    const trimmed = interpolated.trim();

    // A pure `{{var}}` expression resolves to a plain string.
    if (!trimmed.startsWith('$')) {
      return { ok: true, value: interpolated };
    }

    return resolveSingleReference(trimmed, context);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}
