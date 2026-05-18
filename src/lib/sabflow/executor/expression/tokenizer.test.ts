/**
 * SabFlow expression-language tokenizer tests.
 *
 * Track B / Phase 4 / sub-task #2 — 6 cases.
 *
 * Framework-agnostic: each `test()` call is wrapped in a try/catch and the
 * file is also runnable directly with `tsx tokenizer.test.ts`. When Jest /
 * Vitest are present, the `describe`/`it` global is used instead.
 */

import { tokenize, TokenizeError, type Token, type TokenKind } from './tokenizer';

type Case = { name: string; run: () => void };
const CASES: Case[] = [];
const test = (name: string, run: () => void): void => {
  CASES.push({ name, run });
};

const eq = <T>(actual: T, expected: T, label: string): void => {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`${label}: expected ${b}, got ${a}`);
  }
};

const kinds = (toks: Token[]): TokenKind[] => toks.map((t) => t.kind);
const values = (toks: Token[]): string[] => toks.map((t) => t.value);

// ---------------------------------------------------------------------------
// 1. Pure text — no `{{` — yields one TEMPLATE_TEXT + EOF.
// ---------------------------------------------------------------------------
test('pure literal text emits a single TEMPLATE_TEXT', () => {
  const toks = tokenize('hello world');
  eq(kinds(toks), ['TEMPLATE_TEXT', 'EOF'], 'kinds');
  eq(toks[0]!.value, 'hello world', 'text value');
  eq(toks[0]!.line, 1, 'line');
  eq(toks[0]!.col, 1, 'col');
});

// ---------------------------------------------------------------------------
// 2. Mode toggling — text + `{{ $json.foo }}` + text.
// ---------------------------------------------------------------------------
test('toggles between text mode and expression mode on {{ / }}', () => {
  const toks = tokenize('Hi {{ $json.name }}!');
  eq(
    kinds(toks),
    [
      'TEMPLATE_TEXT',
      'TEMPLATE_OPEN',
      'DOLLAR_IDENT',
      'PUNCT',
      'IDENT',
      'TEMPLATE_CLOSE',
      'TEMPLATE_TEXT',
      'EOF',
    ],
    'kinds',
  );
  eq(values(toks), ['Hi ', '{{', '$json', '.', 'name', '}}', '!', ''], 'values');
});

// ---------------------------------------------------------------------------
// 3. `$('Webhook')` accessor — captured as one DOLLAR_IDENT token.
// ---------------------------------------------------------------------------
test('$("Node Name") is captured as a single DOLLAR_IDENT token', () => {
  const toks = tokenize("{{ $('Webhook').item.json.id }}");
  eq(toks[0]!.kind, 'TEMPLATE_OPEN', 'open');
  eq(toks[1]!.kind, 'DOLLAR_IDENT', 'dollar-call kind');
  eq(toks[1]!.value, "$('Webhook')", 'dollar-call value');
  eq(toks[2]!.kind, 'PUNCT', 'dot punct');
  eq(toks[2]!.value, '.', 'dot');
  // …rest is parsed as a member chain followed by `}}` + EOF.
  eq(toks[toks.length - 1]!.kind, 'EOF', 'eof');
});

// ---------------------------------------------------------------------------
// 4. Numeric literals — int / float / scientific / hex / octal / bin / bigint.
// ---------------------------------------------------------------------------
test('recognises all numeric formats', () => {
  const toks = tokenize('{{ 42 + 3.14 + 1e3 + 0xFF + 0o77 + 0b10 + 123n }}');
  const nums = toks.filter((t) => t.kind === 'NUMBER').map((t) => t.value);
  eq(nums, ['42', '3.14', '1e3', '0xFF', '0o77', '0b10', '123n'], 'numbers');
});

// ---------------------------------------------------------------------------
// 5. Strings + escapes — `\n`, `\t`, `\\`, `\"` are decoded; `${…}` stays raw.
// ---------------------------------------------------------------------------
test('decodes escape sequences in strings; `${...}` stays literal', () => {
  const toks = tokenize('{{ "a\\nb\\t\\"c\\\\d${x}" }}');
  const s = toks.find((t) => t.kind === 'STRING')!;
  eq(s.value, 'a\nb\t"c\\d${x}', 'decoded string');
});

// ---------------------------------------------------------------------------
// 6. TokenizeError — illegal `@` char inside an expression with line/col + ctx.
// ---------------------------------------------------------------------------
test('throws TokenizeError with line/col on illegal char', () => {
  let err: unknown;
  try {
    tokenize('{{ foo @ bar }}');
  } catch (e) {
    err = e;
  }
  if (!(err instanceof TokenizeError)) {
    throw new Error('expected TokenizeError');
  }
  eq(err.line, 1, 'line');
  eq(err.col, 8, 'col'); // 1-based: positions of `@` after `{{ foo `
  if (!err.message.includes('@')) {
    throw new Error(`expected message to mention '@', got: ${err.message}`);
  }
});

// ---------------------------------------------------------------------------
// Runner — uses Jest/Vitest `describe`+`it` when present, else stdout.
// ---------------------------------------------------------------------------
declare const describe: ((label: string, fn: () => void) => void) | undefined;
declare const it: ((label: string, fn: () => void) => void) | undefined;

if (typeof describe === 'function' && typeof it === 'function') {
  describe('sabflow/executor/expression/tokenizer', () => {
    for (const c of CASES) it(c.name, c.run);
  });
} else {
  let pass = 0;
  const fail: string[] = [];
  for (const c of CASES) {
    try {
      c.run();
      pass++;

      console.log(`  ok  ${c.name}`);
    } catch (e) {
      fail.push(`  FAIL  ${c.name}\n        ${(e as Error).message}`);
    }
  }

  console.log(`\n${pass}/${CASES.length} passed`);
  if (fail.length) {

    console.error(fail.join('\n'));
    if (typeof process !== 'undefined') process.exit(1);
  }
}
