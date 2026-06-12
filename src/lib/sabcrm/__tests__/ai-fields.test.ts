/**
 * Unit tests for the AI computed-field PURE helpers (`../ai-fields`) and the
 * `aiFieldConfig` parser (`../types`).
 *
 * Runs with Node's built-in `node:test` + `tsx` so no extra deps are required:
 *   npx tsx --test src/lib/sabcrm/__tests__/ai-fields.test.ts
 *
 * The impure half (`ai-fields.server.ts` — Mongo writes, the LLM call) is
 * deliberately NOT imported here: it carries `'server-only'`, which cannot be
 * loaded under `tsx --test` (see gate-security.test.ts for the precedent).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AI_FIELD_SYSTEM,
  aiInputsHash,
  aiSourceFields,
  aiSourceValue,
  coerceAiOutput,
} from '../ai-fields';
import { aiFieldConfig } from '../types';
import type { FieldMetadata } from '../types';

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

function aiField(
  outputType: string,
  extra: Partial<FieldMetadata> = {},
): FieldMetadata {
  return {
    key: 'summary',
    label: 'Summary',
    type: 'AI',
    settings: { ai: { prompt: 'Summarise {{name}}', outputType, refresh: 'auto' } },
    ...extra,
  };
}

/* -------------------------------------------------------------------------- */
/* aiFieldConfig                                                               */
/* -------------------------------------------------------------------------- */

describe('aiFieldConfig', () => {
  it('parses a valid blob', () => {
    const cfg = aiFieldConfig(aiField('NUMBER'));
    assert.deepEqual(cfg, {
      prompt: 'Summarise {{name}}',
      outputType: 'NUMBER',
      refresh: 'auto',
    });
  });

  it('returns null for non-AI fields', () => {
    assert.equal(
      aiFieldConfig({ key: 'k', label: 'K', type: 'TEXT' }),
      null,
    );
  });

  it('returns null without a prompt', () => {
    assert.equal(
      aiFieldConfig({
        key: 'k',
        label: 'K',
        type: 'AI',
        settings: { ai: { outputType: 'TEXT' } },
      }),
      null,
    );
    assert.equal(
      aiFieldConfig({
        key: 'k',
        label: 'K',
        type: 'AI',
        settings: { ai: { prompt: '   ' } },
      }),
      null,
    );
    assert.equal(aiFieldConfig({ key: 'k', label: 'K', type: 'AI' }), null);
  });

  it('defaults outputType to TEXT and refresh to auto', () => {
    const cfg = aiFieldConfig({
      key: 'k',
      label: 'K',
      type: 'AI',
      settings: { ai: { prompt: 'p', outputType: 'NOPE', refresh: 'weekly' } },
    });
    assert.deepEqual(cfg, { prompt: 'p', outputType: 'TEXT', refresh: 'auto' });
  });

  it('honours refresh: manual', () => {
    const cfg = aiFieldConfig({
      key: 'k',
      label: 'K',
      type: 'AI',
      settings: { ai: { prompt: 'p', refresh: 'manual' } },
    });
    assert.equal(cfg?.refresh, 'manual');
  });
});

/* -------------------------------------------------------------------------- */
/* aiSourceFields / aiSourceValue                                              */
/* -------------------------------------------------------------------------- */

describe('aiSourceFields', () => {
  const keys = new Set(['name', 'industry', 'emails']);

  it('extracts tokens that are field keys, in first-occurrence order', () => {
    assert.deepEqual(
      aiSourceFields('A {{ industry }} firm called {{name}} ({{name}})', keys),
      ['industry', 'name'],
    );
  });

  it('drops unknown tokens but keeps updatedAt/createdAt', () => {
    assert.deepEqual(
      aiSourceFields('{{nope}} {{updatedAt}} {{createdAt}} {{name}}', keys),
      ['updatedAt', 'createdAt', 'name'],
    );
  });

  it('accepts dotted tokens whose root is a field key', () => {
    assert.deepEqual(
      aiSourceFields('mail: {{emails.primaryEmail}} / {{ghost.sub}}', keys),
      ['emails.primaryEmail'],
    );
  });

  it('returns [] for a token-free prompt', () => {
    assert.deepEqual(aiSourceFields('no tokens here', keys), []);
  });
});

describe('aiSourceValue', () => {
  const data = {
    name: 'Acme',
    emails: { primaryEmail: 'a@acme.com' },
  };

  it('reads flat keys', () => {
    assert.equal(aiSourceValue(data, 'name'), 'Acme');
  });

  it('resolves dotted paths', () => {
    assert.equal(aiSourceValue(data, 'emails.primaryEmail'), 'a@acme.com');
  });

  it('returns undefined for missing paths / data', () => {
    assert.equal(aiSourceValue(data, 'emails.missing'), undefined);
    assert.equal(aiSourceValue(data, 'name.sub'), undefined);
    assert.equal(aiSourceValue(undefined, 'name'), undefined);
  });
});

/* -------------------------------------------------------------------------- */
/* aiInputsHash                                                                */
/* -------------------------------------------------------------------------- */

describe('aiInputsHash', () => {
  it('is stable: same inputs → same 32-char hex', () => {
    const a = aiInputsHash('p', { name: 'Acme', n: 1 });
    const b = aiInputsHash('p', { name: 'Acme', n: 1 });
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{32}$/);
  });

  it('changes when a value changes', () => {
    assert.notEqual(
      aiInputsHash('p', { name: 'Acme' }),
      aiInputsHash('p', { name: 'Acme Inc' }),
    );
  });

  it('changes when the prompt changes', () => {
    assert.notEqual(
      aiInputsHash('p1', { name: 'Acme' }),
      aiInputsHash('p2', { name: 'Acme' }),
    );
  });
});

/* -------------------------------------------------------------------------- */
/* coerceAiOutput                                                              */
/* -------------------------------------------------------------------------- */

describe('coerceAiOutput', () => {
  it('TEXT: trims and returns the text', () => {
    const r = coerceAiOutput('  Enterprise fintech.  ', aiField('TEXT'));
    assert.deepEqual(r, { status: 'ready', value: 'Enterprise fintech.' });
  });

  it('TEXT: empty reply fails', () => {
    assert.equal(coerceAiOutput('   ', aiField('TEXT')).status, 'failed');
  });

  it('defaults to TEXT for an unknown/missing outputType', () => {
    const noSettings: FieldMetadata = { key: 'k', label: 'K', type: 'AI' };
    assert.deepEqual(coerceAiOutput('hi', noSettings), {
      status: 'ready',
      value: 'hi',
    });
  });

  it('NUMBER: parses, rejects NaN', () => {
    assert.deepEqual(coerceAiOutput(' 42.5 ', aiField('NUMBER')), {
      status: 'ready',
      value: 42.5,
    });
    assert.equal(coerceAiOutput('forty-two', aiField('NUMBER')).status, 'failed');
  });

  it('BOOLEAN: true/yes and false/no, anything else fails', () => {
    assert.equal(coerceAiOutput('Yes', aiField('BOOLEAN')).value, true);
    assert.equal(coerceAiOutput('TRUE', aiField('BOOLEAN')).value, true);
    assert.equal(coerceAiOutput('no', aiField('BOOLEAN')).value, false);
    assert.equal(coerceAiOutput('False', aiField('BOOLEAN')).value, false);
    assert.equal(coerceAiOutput('maybe', aiField('BOOLEAN')).status, 'failed');
  });

  it('SELECT: matches option value OR label case-insensitively, stores the VALUE', () => {
    const field = aiField('SELECT', {
      options: [
        { value: 'ENT', label: 'Enterprise' },
        { value: 'SMB', label: 'Small business' },
      ],
    });
    assert.equal(coerceAiOutput('enterprise', field).value, 'ENT');
    assert.equal(coerceAiOutput('ent', field).value, 'ENT');
    assert.equal(coerceAiOutput('Small Business', field).value, 'SMB');
    assert.equal(coerceAiOutput('Mid-market', field).status, 'failed');
  });

  it('RATING: integer 1..5 only', () => {
    assert.equal(coerceAiOutput('4', aiField('RATING')).value, 4);
    assert.equal(coerceAiOutput('0', aiField('RATING')).status, 'failed');
    assert.equal(coerceAiOutput('6', aiField('RATING')).status, 'failed');
    assert.equal(coerceAiOutput('3.5', aiField('RATING')).status, 'failed');
    assert.equal(coerceAiOutput('great', aiField('RATING')).status, 'failed');
  });

  it('system prompt demands a bare value', () => {
    assert.match(AI_FIELD_SYSTEM, /ONLY the value/);
    assert.match(AI_FIELD_SYSTEM, /UNKNOWN/);
  });
});
