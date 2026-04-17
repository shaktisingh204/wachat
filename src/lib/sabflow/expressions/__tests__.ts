/**
 * Internal developer-only smoke tests for the expression evaluator.
 *
 * This file intentionally does NOT hook into a test runner.  Call
 * `__devTest()` manually from a Node REPL or a one-off script to verify
 * nothing has regressed after changes to the tokenizer / parser / evaluator.
 *
 *   import { __devTest } from '@/lib/sabflow/expressions';
 *   __devTest(); // → logs "20/20 passed"
 */

import { resolveExpression, resolveTemplate } from './resolve';
import type { ExpressionContext } from './types';

function buildContext(): ExpressionContext {
  return {
    json: { foo: 'bar', nested: { x: 7 }, arr: [10, 20, 30], price: 99.5 },
    input: {
      item: { json: { id: 'abc-1', qty: 2 } },
      all: [
        { json: { id: 'a', qty: 1 } },
        { json: { id: 'b', qty: 5 } },
      ],
    },
    node: {
      HttpRequest: { json: { statusCode: 200, body: { token: 'xyz' } } },
      'My Node': { json: { value: 'spaced-name' } },
    },
    vars: { name: 'Alice', age: 30, tags: ['a', 'b', 'c'] },
    env: { API_KEY: 'secret', BASE_URL: 'https://example.com' },
    now: new Date('2026-04-16T12:34:56.000Z'),
    workflow: { id: 'wf-1', name: 'TestFlow' },
    execution: { id: 'ex-9', mode: 'test' },
  };
}

type Case = { name: string; run: (ctx: ExpressionContext) => boolean };

const CASES: Case[] = [
  {
    name: '$json dotted access',
    run: (ctx) => resolveExpression('{{ $json.foo }}', ctx).value === 'bar',
  },
  {
    name: '$json nested access',
    run: (ctx) => resolveExpression('{{ $json.nested.x }}', ctx).value === 7,
  },
  {
    name: '$node bracket access (quoted name with space)',
    run: (ctx) => resolveExpression('{{ $node["My Node"].json.value }}', ctx).value === 'spaced-name',
  },
  {
    name: '$node dot access',
    run: (ctx) => resolveExpression('{{ $node.HttpRequest.json.body.token }}', ctx).value === 'xyz',
  },
  {
    name: '$input.item.json.x',
    run: (ctx) => resolveExpression('{{ $input.item.json.qty }}', ctx).value === 2,
  },
  {
    name: '$input.all[1].json.id',
    run: (ctx) => resolveExpression('{{ $input.all[1].json.id }}', ctx).value === 'b',
  },
  {
    name: 'Bare Typebot variable',
    run: (ctx) => resolveExpression('{{ name }}', ctx).value === 'Alice',
  },
  {
    name: '$vars.name',
    run: (ctx) => resolveExpression('{{ $vars.name }}', ctx).value === 'Alice',
  },
  {
    name: '$env.API_KEY',
    run: (ctx) => resolveExpression('{{ $env.API_KEY }}', ctx).value === 'secret',
  },
  {
    name: '$now.format(YYYY-MM-DD)',
    run: (ctx) => resolveExpression('{{ $now.format("YYYY-MM-DD") }}', ctx).value === '2026-04-16',
  },
  {
    name: 'trim()',
    run: (ctx) => resolveExpression('{{ "  hi  ".trim() }}', ctx).value === 'hi',
  },
  {
    name: 'toUpperCase chain',
    run: (ctx) => resolveExpression('{{ $json.foo.toUpperCase() }}', ctx).value === 'BAR',
  },
  {
    name: 'Arithmetic + coercion',
    run: (ctx) => resolveExpression('{{ $json.price * 2 + 1 }}', ctx).value === 200,
  },
  {
    name: 'Comparison + ternary',
    run: (ctx) => resolveExpression('{{ $vars.age >= 18 ? "adult" : "minor" }}', ctx).value === 'adult',
  },
  {
    name: 'Logical && short-circuit',
    run: (ctx) => resolveExpression('{{ $vars.age > 0 && $json.foo }}', ctx).value === 'bar',
  },
  {
    name: 'Array.join',
    run: (ctx) => resolveExpression('{{ $vars.tags.join("-") }}', ctx).value === 'a-b-c',
  },
  {
    name: 'String concat with template',
    run: (ctx) => resolveTemplate('Hello {{ $vars.name }}!', ctx) === 'Hello Alice!',
  },
  {
    name: 'Prototype pollution guard',
    run: (ctx) => resolveExpression('{{ $json.__proto__ }}', ctx).value === undefined,
  },
  {
    name: 'JSON.stringify builtin',
    run: (ctx) => resolveExpression('{{ JSON.stringify($json.nested) }}', ctx).value === '{"x":7}',
  },
  {
    name: 'Error propagation (unknown function)',
    run: (ctx) => {
      const r = resolveExpression('{{ noSuchFunction() }}', ctx);
      return r.error !== undefined && r.value === undefined;
    },
  },
];

/**
 * Run every dev-test and log results.  Returns the pass-count so callers can
 * assert in CI if they wire this into a runner in the future.
 */
export function __devTest(): { passed: number; total: number; failures: string[] } {
  const ctx = buildContext();
  const failures: string[] = [];
  let passed = 0;
  for (const c of CASES) {
    let ok = false;
    try {
      ok = c.run(ctx);
    } catch (err) {
      ok = false;
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${c.name}: threw — ${msg}`);
      continue;
    }
    if (ok) passed++;
    else failures.push(c.name);
  }
  // eslint-disable-next-line no-console
  console.log(`[sabflow/expressions] ${passed}/${CASES.length} passed`);
  if (failures.length > 0) {
    // eslint-disable-next-line no-console
    console.log('failures:', failures);
  }
  return { passed, total: CASES.length, failures };
}
