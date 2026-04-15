// Expression Engine for SabFlow
// Supports:
// {{ variableName }} - simple variable from context
// {{ $node['Step Name'].output.field }} - named node reference
// {{ $json.field }} - shorthand for current item JSON
// {{ $env.VAR_NAME }} - environment variables
// {{ $workflow.id }} - flow metadata
// {{ $execution.id }} - execution metadata
// {{ $now }} - current datetime as Date object
// {{ $today }} - today's date as string YYYY-MM-DD
// {{ $timestamp }} - unix timestamp
// {{ expression * 2 }} - arithmetic
// {{ expression.toUpperCase() }} - string methods
// {{ field ? 'yes' : 'no' }} - ternary expressions

export interface ExpressionContext {
  // Current execution context (step outputs)
  [stepName: string]: any;

  // Special n8n-style variables
  $json?: any;                                       // current item being processed
  $node?: Record<string, { output: any }>;           // access by step name
  $env?: Record<string, string>;                     // environment variables
  $workflow?: { id: string; name: string };
  $execution?: { id: string; startedAt: Date };
  $now?: Date;
  $today?: string;
  $timestamp?: number;
  $vars?: Record<string, any>;                       // user-defined variables
}

// Regex that matches {{ ... }} blocks (non-greedy, allows multi-char content)
const EXPRESSION_REGEX = /{{\s*([\s\S]+?)\s*}}/g;

/**
 * Build a sandboxed evaluator function for a single expression string.
 * The context keys are spread as named parameters so identifiers resolve
 * naturally (e.g. `price * 1.18`, `name.toLowerCase()`).
 *
 * Uses `new Function` — no `eval` — with a restricted scope.
 */
function evalExpression(expr: string, ctx: ExpressionContext): any {
  // Compute time-sensitive values fresh on every evaluation
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const ts = now.getTime();

  const fullCtx: ExpressionContext = {
    ...ctx,
    $now: ctx.$now ?? now,
    $today: ctx.$today ?? todayStr,
    $timestamp: ctx.$timestamp ?? ts,
  };

  // Build a sorted list of context keys to use as parameter names.
  // We must be careful: some keys may not be valid JS identifiers
  // (e.g. "Contact Created" with spaces). We expose the full context
  // object as `_ctx` and also spread safe identifiers for convenience.
  const safeKeys = Object.keys(fullCtx).filter((k) => /^[$a-zA-Z_][$\w]*$/.test(k));

  // Build the function body:
  //   - Destructure safe identifier keys from _ctx
  //   - Return the expression result
  const paramDestructure = safeKeys.length
    ? `const { ${safeKeys.join(', ')} } = _ctx;`
    : '';

  const fnBody = `"use strict";\n${paramDestructure}\nreturn (${expr});`;

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('_ctx', fnBody);
    return fn(fullCtx);
  } catch {
    // Return undefined so the caller can decide what to keep
    return undefined;
  }
}

/**
 * Resolve a single expression string like "stepName.field.nested" or
 * a full JS expression like "price * 1.18".
 *
 * First tries a fast dot/bracket path lookup (backwards-compatible with the
 * existing `getValueFromPath` behaviour), then falls back to full JS eval.
 */
export function resolveSingleExpression(expr: string, context: ExpressionContext): any {
  const trimmed = expr.trim();
  if (!trimmed) return undefined;

  // --- Fast path: simple dot/bracket notation ---------------------------------
  // Matches: identifier chains with optional [n] array access
  // e.g. "Contact_Created.name", "items[0].price", "$json.field"
  if (/^[$a-zA-Z_][$\w]*(\[(\d+|'[^']+'|"[^"]+")\]|\.[$a-zA-Z_$][$\w]*)*$/.test(trimmed)) {
    const value = evalExpression(trimmed, context);
    if (value !== undefined) return value;
  }

  // --- Full JS expression eval ------------------------------------------------
  return evalExpression(trimmed, context);
}

/**
 * Resolve all {{ }} expressions in `value`.
 *
 * - If `value` is not a string, it is returned as-is.
 * - If the entire string is a single `{{ expr }}` and the result is not a
 *   string, the raw value (object, array, number, ...) is returned directly —
 *   matching the existing `interpolate` behaviour.
 * - Otherwise every placeholder is replaced with its string representation.
 * - On any error the original placeholder is kept (graceful degradation).
 */
export function resolveExpression(value: any, context: ExpressionContext): any {
  if (typeof value !== 'string') return value;

  const str = value;

  // Check if the whole string is exactly one expression
  const singleMatch = str.match(/^{{\s*([\s\S]+?)\s*}}$/);
  if (singleMatch) {
    const resolved = resolveSingleExpression(singleMatch[1], context);
    // Return raw value (preserves objects/arrays/numbers)
    return resolved !== undefined && resolved !== null ? resolved : str;
  }

  // Multiple expressions or mixed text — replace all occurrences with strings
  // Reset lastIndex before using the global regex
  EXPRESSION_REGEX.lastIndex = 0;
  const result = str.replace(EXPRESSION_REGEX, (_fullMatch, expr) => {
    const resolved = resolveSingleExpression(expr, context);
    if (resolved === undefined || resolved === null) {
      return _fullMatch; // keep original placeholder
    }
    if (typeof resolved === 'object') {
      try {
        return JSON.stringify(resolved, null, 2);
      } catch {
        return String(resolved);
      }
    }
    return String(resolved);
  });

  return result;
}

/**
 * Build the full ExpressionContext for a flow execution.
 *
 * @param executionContext  - flat map of { stepName: stepOutput } from the DB
 * @param flowId           - MongoDB ObjectId string of the flow
 * @param flowName         - human-readable flow name
 * @param executionId      - MongoDB ObjectId string of the execution
 * @param currentItem      - optional current item (used as $json)
 */
export function buildExpressionContext(
  executionContext: Record<string, any>,
  flowId: string,
  flowName: string,
  executionId: string,
  currentItem?: any,
): ExpressionContext {
  const now = new Date();

  // Build $node map: { 'Step Name': { output: <stepOutput> } }
  const $node: Record<string, { output: any }> = {};
  for (const [stepName, stepOutput] of Object.entries(executionContext)) {
    $node[stepName] = { output: stepOutput };
  }

  return {
    // Spread raw step outputs at top level for backwards-compatible access
    // e.g. {{ Contact_Created.name }}
    ...executionContext,

    // n8n-style special variables
    $json: currentItem,
    $node,
    $env: process.env as Record<string, string>,
    $workflow: { id: flowId, name: flowName },
    $execution: { id: executionId, startedAt: now },
    $now: now,
    $today: now.toISOString().slice(0, 10),
    $timestamp: now.getTime(),
    $vars: {},
  };
}

/**
 * Returns true if `value` contains at least one `{{ }}` expression.
 */
export function hasExpressions(value: string): boolean {
  if (typeof value !== 'string') return false;
  EXPRESSION_REGEX.lastIndex = 0;
  return EXPRESSION_REGEX.test(value);
}

/**
 * Extract all raw expression strings from a template.
 * Useful for static analysis / validation of a node's inputs before execution.
 *
 * @example
 *   extractExpressionPaths('Hello {{ user.name }}, total: {{ price * 1.18 }}')
 *   // => ['user.name', 'price * 1.18']
 */
export function extractExpressionPaths(template: string): string[] {
  if (typeof template !== 'string') return [];
  const paths: string[] = [];
  EXPRESSION_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = EXPRESSION_REGEX.exec(template)) !== null) {
    paths.push(match[1].trim());
  }
  return paths;
}
