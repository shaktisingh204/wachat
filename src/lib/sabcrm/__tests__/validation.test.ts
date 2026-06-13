/**
 * Unit tests for the validation PURE evaluator (`../validation`).
 *   npx tsx --test src/lib/sabcrm/__tests__/validation.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  evaluateValidation,
  mergeValidationResults,
  type ValidationRule,
} from '../validation';

function rule(
  id: string,
  condition: ValidationRule['condition'],
  severity: ValidationRule['severity'],
  message = id,
): ValidationRule {
  return { id, condition, severity, message };
}

describe('evaluateValidation', () => {
  it('fires a block rule when the violation condition matches', () => {
    const rs = { rules: [rule('email-req', { field: 'email', op: 'isEmpty' }, 'block', 'Email is required')] };
    const bad = evaluateValidation(rs, { email: '' });
    assert.equal(bad.ok, false);
    assert.equal(bad.blocked.length, 1);
    assert.equal(bad.blocked[0].message, 'Email is required');

    const good = evaluateValidation(rs, { email: 'a@b.com' });
    assert.equal(good.ok, true);
    assert.equal(good.blocked.length, 0);
  });

  it('separates warn from block and keeps ok true for warn-only', () => {
    const rs = {
      rules: [
        rule('amt', { field: 'amount', op: 'lte', value: 0 }, 'block', 'Amount must be > 0'),
        rule('note', { field: 'note', op: 'isEmpty' }, 'warn', 'Consider adding a note'),
      ],
    };
    const r = evaluateValidation(rs, { amount: 100, note: '' });
    assert.equal(r.ok, true); // only a warn fired
    assert.equal(r.warnings.length, 1);
    assert.equal(r.blocked.length, 0);
  });

  it('skips disabled rules', () => {
    const rs = {
      rules: [{ ...rule('x', { field: 'a', op: 'isEmpty' }, 'block'), enabled: false }],
    };
    assert.equal(evaluateValidation(rs, { a: '' }).ok, true);
  });

  it('handles cross-field and list conditions', () => {
    const rs = {
      rules: [rule('stage', { field: 'stage', op: 'in', value: ['lost'] }, 'block', 'No saving lost')],
    };
    assert.equal(evaluateValidation(rs, { stage: 'lost' }).ok, false);
    assert.equal(evaluateValidation(rs, { stage: 'won' }).ok, true);
  });
});

describe('mergeValidationResults', () => {
  it('is ok only when no set blocked, and concatenates violations', () => {
    const a = evaluateValidation(
      { rules: [rule('a', { field: 'x', op: 'isEmpty' }, 'block')] },
      { x: '' },
    );
    const b = evaluateValidation(
      { rules: [rule('b', { field: 'y', op: 'isEmpty' }, 'warn')] },
      { y: '' },
    );
    const merged = mergeValidationResults([a, b]);
    assert.equal(merged.ok, false);
    assert.equal(merged.blocked.length, 1);
    assert.equal(merged.warnings.length, 1);
  });
});
