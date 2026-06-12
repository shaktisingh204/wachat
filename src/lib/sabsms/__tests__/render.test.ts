/**
 * Unit tests for the SabSMS template renderer (`../render.ts`).
 *
 *   npx tsx --test src/lib/sabsms/__tests__/render.test.ts
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { extractVariables, renderTemplate } from '../render';

// ─── renderTemplate — named vars ──────────────────────────────────────────

test('replaces named vars with trimmed keys', () => {
  const r = renderTemplate('Hi {{ name }}, order {{orderId}} shipped.', {
    name: 'Asha',
    orderId: 'A-42',
  });
  assert.equal(r.text, 'Hi Asha, order A-42 shipped.');
  assert.deepEqual(r.missing, []);
});

test('numbers stringify; zero renders as "0"', () => {
  const r = renderTemplate('{{count}} items, {{zero}} errors', { count: 7, zero: 0 });
  assert.equal(r.text, '7 items, 0 errors');
  assert.deepEqual(r.missing, []);
});

test('fallback syntax {{name|fallback text}} is used when the var is absent', () => {
  const r = renderTemplate('Hi {{name|there}}!', {});
  assert.equal(r.text, 'Hi there!');
  assert.deepEqual(r.missing, []);
});

test('fallback is ignored when the var is present', () => {
  const r = renderTemplate('Hi {{ name | there }}!', { name: 'Asha' });
  assert.equal(r.text, 'Hi Asha!');
});

test('fallback may contain pipes (split on the first pipe only)', () => {
  const r = renderTemplate('{{x|a|b}}', {});
  assert.equal(r.text, 'a|b');
});

test('null and undefined values count as absent', () => {
  const r = renderTemplate('{{a|A}} {{b|B}}', { a: null, b: undefined });
  assert.equal(r.text, 'A B');
});

test('unknown named var without fallback keeps the literal and reports missing', () => {
  const r = renderTemplate('Hi {{name}}, code {{otp}}', { name: 'Asha' });
  assert.equal(r.text, 'Hi Asha, code {{otp}}');
  assert.deepEqual(r.missing, ['otp']);
});

test('missing keys are deduplicated', () => {
  const r = renderTemplate('{{x}} and {{ x }} again', {});
  assert.equal(r.text, '{{x}} and {{ x }} again');
  assert.deepEqual(r.missing, ['x']);
});

test('empty braces are not variables', () => {
  const r = renderTemplate('{{}} stays', {});
  assert.equal(r.text, '{{}} stays');
  assert.deepEqual(r.missing, []);
});

// ─── renderTemplate — DLT positional vars ─────────────────────────────────

test('DLT {#var#} slots fill in order from opts.positional', () => {
  const r = renderTemplate('Dear {#var#}, your OTP is {#var#}.', {}, {
    positional: ['Asha', '482913'],
  });
  assert.equal(r.text, 'Dear Asha, your OTP is 482913.');
  assert.deepEqual(r.missing, []);
});

test('positional shortfall keeps the literal and reports #<ordinal>', () => {
  const r = renderTemplate('{#var#} / {#var#} / {#var#}', {}, { positional: ['one'] });
  assert.equal(r.text, 'one / {#var#} / {#var#}');
  assert.deepEqual(r.missing, ['#2', '#3']);
});

test('positional accepts numbers and tolerates inner whitespace', () => {
  const r = renderTemplate('Bal: {# var #}', {}, { positional: [99] });
  assert.equal(r.text, 'Bal: 99');
});

test('named and positional mix in one body', () => {
  const r = renderTemplate('Hi {{name}}, OTP {#var#} expires in {{mins|10}} min', {
    name: 'Dev',
  }, { positional: ['1234'] });
  assert.equal(r.text, 'Hi Dev, OTP 1234 expires in 10 min');
  assert.deepEqual(r.missing, []);
});

// ─── extractVariables ─────────────────────────────────────────────────────

test('extractVariables returns named keys in order of first appearance', () => {
  const e = extractVariables('Hi {{name}}, {{orderId}} for {{ name }}');
  assert.deepEqual(e.named, ['name', 'orderId']);
  assert.equal(e.positionalCount, 0);
});

test('extractVariables strips fallbacks from keys', () => {
  const e = extractVariables('{{first|friend}} {{last | }}');
  assert.deepEqual(e.named, ['first', 'last']);
});

test('extractVariables counts DLT slots', () => {
  const e = extractVariables('{#var#} {{x}} {#var#} {#VAR#}');
  assert.equal(e.positionalCount, 3);
  assert.deepEqual(e.named, ['x']);
});

test('extractVariables on a plain body is empty', () => {
  const e = extractVariables('No variables here.');
  assert.deepEqual(e.named, []);
  assert.equal(e.positionalCount, 0);
});
