/**
 * ExpressionContext — runtime data bag resolved against when evaluating
 * an n8n-style SabFlow expression.
 *
 * `$json`      — the current item's JSON payload (usually the last block's output)
 * `$input`     — the inbound data for the currently-executing block
 * `$node`      — map keyed by a node's human-readable name (group.title / block.id)
 * `$vars`      — Typebot-compatible flow variables (also referenced via bare identifiers)
 * `$env`       — whitelisted env vars (read-only — writes are ignored)
 * `$now`       — a Date instance captured at the start of the block run
 * `$workflow`  — the flow being executed
 * `$execution` — the current execution (manual run, trigger, test)
 */
export type ExpressionContext = {
  json: unknown;
  input: {
    item: { json: unknown };
    all: { json: unknown }[];
  };
  node: Record<string, { json: unknown }>;
  vars: Record<string, unknown>;
  env?: Record<string, string>;
  now: Date;
  workflow?: { id: string; name: string };
  execution?: { id: string; mode: 'manual' | 'trigger' | 'test' };
};

/**
 * Result of evaluating a single expression.
 * - `value` is always present (may be `undefined` on error)
 * - `error` is populated with a short diagnostic string when evaluation fails
 */
export type ExpressionResult = {
  value: unknown;
  error?: string;
};
