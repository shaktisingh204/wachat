/**
 * Server-only token resolver.
 *
 * Bridges the two expression worlds in SabFlow:
 *
 *   - Plain `{{variableName}}` substitution — browser-safe, handled by
 *     `substituteVariables`.  Cheap, dependency-light.
 *   - Advanced n8n-style expressions — `{{ $node["X"].json.foo }}`,
 *     `{{ $json.bar }}`, `{{ $now.toFormat("yyyy-MM-dd") }}` — routed
 *     through the full n8n expression engine via `evaluateExpression`.
 *
 * The resolver auto-detects which engine to use by inspecting the template;
 * callers never have to pick.  When advanced tokens are present, upstream
 * node outputs (keyed by display name from `buildBlockNameMap`) are
 * threaded into `$node`, making picker-emitted tokens like
 *
 *     {{ $node["OpenAI"].json.choices.0.message.content }}
 *
 * resolve to real values at runtime.
 *
 * **Do not import this file from client bundles** — the n8n adapter pulls
 * in Node-only packages.
 */

import type { SabFlowDoc } from '@/lib/sabflow/types';
import { substituteVariables } from './substituteVariables';
import { evaluateExpression, resolveValue } from '@/lib/sabflow/n8n/expression-runner';

/** Tokens that require the full n8n engine. */
const ADVANCED_TOKEN_RE =
  /\{\{\s*\$(?:node|prevNode|json|input|vars|variables|now|today|workflow|execution|env|secrets|item|items|itemIndex|runIndex|thisItem|thisItemIndex|jmesPath|jmespath|getPairedItem)\b|\{\{\s*(?:DateTime|Duration|Interval)\b/;

export type ResolveTokensCtx = {
  /** Flow variables resolved to their runtime values. */
  variables?: Record<string, unknown>;
  /** Current item payload available as `$json`. */
  json?: Record<string, unknown>;
  /**
   * Upstream node outputs keyed by **display name** (must match the n8n
   * adapter's node-name convention — see `buildBlockNameMap`).  Used to
   * resolve `$node["<name>"].json.<path>` references.
   */
  nodeOutputs?: Record<string, unknown>;
  /** Flow doc — exposes `$workflow` and lets the engine resolve node connections. */
  flow?: SabFlowDoc;
  /** Display name of the node currently being executed. */
  currentNodeName?: string;
  /**
   * Display name of the immediately-upstream node — powers `$prevNode.name`
   * + `$prevNode.json.<x>` shortcuts. When omitted the engine falls back to
   * an empty stub so templates referencing it don't crash on root nodes.
   */
  prevNodeName?: string;
  /**
   * Execution metadata exposed as `$execution.id` / `$execution.mode`.
   * Threaded from `executeFlow` so users can stamp runs with the current
   * execution id (e.g. for idempotency keys or trace headers).
   */
  execution?: { id: string; mode: 'manual' | 'trigger' | 'test' };
  /**
   * Allowlist of process env var names exposed as `$env.<KEY>`. Default-
   * deny: any env var NOT in the list reads as undefined inside templates
   * so flow authors can't accidentally exfiltrate secrets.
   */
  envAllowlist?: string[];
  /**
   * Current iteration index inside the executing block. Exposed as
   * `$itemIndex` in expressions and used by `$getPairedItem(target)` to
   * walk ancestry back to a named ancestor's contributing item.
   */
  currentItemIndex?: number;
  /** Timezone for Luxon-powered helpers.  Defaults to UTC. */
  timezone?: string;
};

/**
 * Pick the allowlisted env vars off `process.env` into a plain map. Called
 * once per template resolution; cheap because most flows use < 5 vars.
 */
function pickEnv(allowlist?: string[]): Record<string, string> {
  if (!allowlist || allowlist.length === 0) return {};
  const out: Record<string, string> = {};
  for (const k of allowlist) {
    const v = process.env[k];
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

/**
 * Returns true when `text` contains at least one advanced expression token.
 * Exposed so callers can short-circuit batched substitutions.
 */
export function hasAdvancedTokens(text: string): boolean {
  return typeof text === 'string' && ADVANCED_TOKEN_RE.test(text);
}

/**
 * Resolve a single template string.  Returns the original string verbatim
 * when no tokens are present.
 */
export function resolveTemplate(text: string, ctx: ResolveTokensCtx): string {
  if (typeof text !== 'string' || !text.includes('{{')) return text;

  if (hasAdvancedTokens(text)) {
    // Two-pass: first substitute plain `{{varName}}` tokens (they sit
    // alongside advanced tokens in mixed templates and the n8n engine
    // doesn't know about bare-identifier flow variables), then let the
    // engine resolve everything starting with `$`.
    const simpleVars = toStringMap(ctx.variables ?? {});
    const preSubstituted = substituteVariables(text, simpleVars);
    try {
      const result = evaluateExpression(preSubstituted, {
        json: ctx.json,
        variables: ctx.variables,
        nodeOutputs: ctx.nodeOutputs,
        flow: ctx.flow,
        currentNodeName: ctx.currentNodeName,
        prevNodeName: ctx.prevNodeName,
        execution: ctx.execution,
        env: pickEnv(ctx.envAllowlist),
        currentItemIndex: ctx.currentItemIndex,
        timezone: ctx.timezone,
      });
      return coerceString(result);
    } catch (err) {
      // Fail-safe: log the failure but leave the original token in place so
      // authors can debug.  Matches the browser-safe path's behaviour.
      // eslint-disable-next-line no-console
      console.warn('[sabflow] expression evaluation failed:', err);
      return text;
    }
  }

  // Browser-safe fallback for plain {{varName}} tokens.
  const simpleVars = toStringMap(ctx.variables ?? {});
  return substituteVariables(text, simpleVars);
}

/**
 * Recursively resolve every leaf string inside `value`.  Use this when the
 * caller has a `block.options` object and wants every templated field
 * resolved in one pass.
 */
export function resolveDeep<T>(value: T, ctx: ResolveTokensCtx): T {
  if (typeof value === 'string') {
    if (!value.includes('{{')) return value;
    if (hasAdvancedTokens(value)) {
      // Same two-pass strategy as resolveTemplate — substitute bare
      // `{{varName}}` first, then route the rest through the n8n engine.
      const simpleVars = toStringMap(ctx.variables ?? {});
      const preSubstituted = substituteVariables(value, simpleVars);
      try {
        return resolveValue(preSubstituted, {
          json: ctx.json,
          variables: ctx.variables,
          nodeOutputs: ctx.nodeOutputs,
          flow: ctx.flow,
          currentNodeName: ctx.currentNodeName,
          prevNodeName: ctx.prevNodeName,
          execution: ctx.execution,
          env: pickEnv(ctx.envAllowlist),
          currentItemIndex: ctx.currentItemIndex,
          timezone: ctx.timezone,
        }) as T;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[sabflow] expression evaluation failed:', err);
        return value;
      }
    }
    const simpleVars = toStringMap(ctx.variables ?? {});
    return substituteVariables(value, simpleVars) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveDeep(item, ctx)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveDeep(v, ctx);
    }
    return out as T;
  }
  return value;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function toStringMap(source: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(source)) {
    if (v === undefined || v === null) {
      out[k] = '';
    } else if (typeof v === 'string') {
      out[k] = v;
    } else {
      try {
        out[k] = JSON.stringify(v);
      } catch {
        out[k] = String(v);
      }
    }
  }
  return out;
}

function coerceString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
