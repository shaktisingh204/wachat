/**
 * Interpolates n8n-style variable expressions inside strings.
 *
 * Supported patterns:
 *   {{$node["NodeName"].data["field"]}}
 *   {{$node.NodeName.data.field}}
 *   {{$json["field"]}}
 *   {{$json.field}}
 *   {{$workflow.id}}
 *   {{$execution.id}}
 *   {{$vars.variableName}}
 *
 * Nested field access is supported: {{$json.address.city}}
 */

import type { ExecutionContext } from '../types';

type InterpolationScope = {
  context: ExecutionContext;
  /** Items from the current node's input (for $json) */
  currentItems: Record<string, unknown>[];
  /** Index of the current item being processed */
  itemIndex: number;
};

/** Safely resolve a dot-notated key path on an object. */
function resolvePath(obj: unknown, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Parse a bracket-or-dot notation accessor into path segments.
 * e.g. `["NodeName"].data["field"]` → ["NodeName", "data", "field"]
 *      `.NodeName.data.field`      → ["NodeName", "data", "field"]
 */
function parsePath(raw: string): string[] {
  const parts: string[] = [];
  // Match either ["..."] or .identifier segments
  const regex = /\["([^"]+)"\]|\.([^.[]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    parts.push(match[1] ?? match[2]);
  }
  return parts;
}

/** Evaluate a single `{{...}}` expression. */
function evaluateExpression(expr: string, scope: InterpolationScope): unknown {
  const { context, currentItems, itemIndex } = scope;
  const trimmed = expr.trim();

  // $json — current item's data
  if (trimmed.startsWith('$json')) {
    const rest = trimmed.slice(5); // everything after "$json"
    if (!rest) return currentItems[itemIndex] ?? {};
    const path = parsePath(rest);
    return resolvePath(currentItems[itemIndex], path);
  }

  // $node["Name"].data[...] or $node.Name.data[...]
  if (trimmed.startsWith('$node')) {
    const rest = trimmed.slice(5);
    const parts = parsePath(rest);
    if (parts.length === 0) return undefined;
    const [nodeName, section, ...fieldPath] = parts;
    const nodeOutput = context.nodeOutputs[nodeName];
    if (!nodeOutput) return undefined;
    if (section === 'data') {
      return resolvePath(nodeOutput[0] ?? {}, fieldPath);
    }
    if (section === 'json') {
      return resolvePath(nodeOutput[0] ?? {}, fieldPath);
    }
    return undefined;
  }

  // $workflow
  if (trimmed.startsWith('$workflow')) {
    const rest = trimmed.slice(9);
    const parts = parsePath(rest);
    if (parts[0] === 'id') return context.workflowId;
    return undefined;
  }

  // $execution
  if (trimmed.startsWith('$execution')) {
    const rest = trimmed.slice(10);
    const parts = parsePath(rest);
    if (parts[0] === 'id') return context.executionId;
    return undefined;
  }

  // $vars — workflow-level variables
  if (trimmed.startsWith('$vars')) {
    const rest = trimmed.slice(5);
    const parts = parsePath(rest);
    return resolvePath(context.variables, parts);
  }

  // Plain variable name — look up in context.variables
  if (/^[a-zA-Z_][\w.]*$/.test(trimmed)) {
    const parts = trimmed.split('.');
    return resolvePath(context.variables, parts);
  }

  return undefined;
}

/** Replace all `{{expr}}` tokens in a string. Returns the raw value when the
 *  entire string is a single expression (preserves type). */
export function interpolateVariables(
  template: unknown,
  scope: InterpolationScope
): unknown {
  if (typeof template !== 'string') return template;

  // If the whole string is a single expression, return the raw resolved value
  const singleExpr = template.match(/^\{\{(.+?)\}\}$/s);
  if (singleExpr) {
    const value = evaluateExpression(singleExpr[1], scope);
    return value ?? template;
  }

  // Otherwise perform string substitution
  return template.replace(/\{\{(.+?)\}\}/gs, (_, expr) => {
    const value = evaluateExpression(expr, scope);
    if (value == null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

/**
 * Recursively interpolate all string values in an object/array.
 */
export function interpolateObject(
  obj: unknown,
  scope: InterpolationScope
): unknown {
  if (typeof obj === 'string') return interpolateVariables(obj, scope);
  if (Array.isArray(obj)) return obj.map((item) => interpolateObject(item, scope));
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = interpolateObject(val, scope);
    }
    return result;
  }
  return obj;
}

/** Convenience: interpolate a parameters object for a node. */
export function interpolateParameters(
  parameters: Record<string, unknown>,
  context: ExecutionContext,
  inputItems: Record<string, unknown>[],
  itemIndex = 0
): Record<string, unknown> {
  const scope: InterpolationScope = { context, currentItems: inputItems, itemIndex };
  return interpolateObject(parameters, scope) as Record<string, unknown>;
}
