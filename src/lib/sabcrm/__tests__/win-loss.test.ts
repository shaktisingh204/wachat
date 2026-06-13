/**
 * Unit tests for win/loss PURE classify + validate (`../win-loss`).
 *   npx tsx --test src/lib/sabcrm/__tests__/win-loss.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  classifyOutcome,
  isReasonRequired,
  validateOutcomeReason,
  type WinLossRules,
} from '../win-loss';

const WON = ['Closed Won', 'Won'];
const LOST = ['Closed Lost', 'Disqualified'];

function rules(over: Partial<WinLossRules> = {}): WinLossRules {
  return {
    wonStages: WON,
    lostStages: LOST,
    requireWonReason: true,
    requireLostReason: true,
    winReasonOptions: [
      { value: 'price', label: 'Best price' },
      { value: 'features', label: 'Features' },
    ],
    lossReasonOptions: [
      { value: 'too_expensive', label: 'Too expensive' },
      { value: 'competitor', label: 'Lost to competitor' },
    ],
    ...over,
  };
}

describe('classifyOutcome', () => {
  it('classifies won stages (case + whitespace insensitive)', () => {
    assert.equal(classifyOutcome('Closed Won', WON, LOST), 'won');
    assert.equal(classifyOutcome('  closed won  ', WON, LOST), 'won');
    assert.equal(classifyOutcome('WON', WON, LOST), 'won');
  });
  it('classifies lost stages', () => {
    assert.equal(classifyOutcome('Closed Lost', WON, LOST), 'lost');
    assert.equal(classifyOutcome('disqualified', WON, LOST), 'lost');
  });
  it('returns open for unmatched / empty stages', () => {
    assert.equal(classifyOutcome('Negotiation', WON, LOST), 'open');
    assert.equal(classifyOutcome('', WON, LOST), 'open');
    assert.equal(classifyOutcome(null, WON, LOST), 'open');
    assert.equal(classifyOutcome(undefined, WON, LOST), 'open');
  });
  it('prefers won when a stage is (mis)configured in both lists', () => {
    assert.equal(classifyOutcome('X', ['X'], ['X']), 'won');
  });
  it('treats empty config lists as never-matching', () => {
    assert.equal(classifyOutcome('Closed Won', [], []), 'open');
  });
});

describe('isReasonRequired', () => {
  it('respects per-outcome require flags', () => {
    const r = rules({ requireWonReason: true, requireLostReason: false });
    assert.equal(isReasonRequired('won', r), true);
    assert.equal(isReasonRequired('lost', r), false);
    assert.equal(isReasonRequired('open', r), false);
  });
});

describe('validateOutcomeReason', () => {
  it('open outcome is always ok regardless of reason', () => {
    assert.deepEqual(validateOutcomeReason('open', '', rules()), { ok: true });
  });

  it('ok when a reason is not required, even if empty', () => {
    const r = rules({ requireWonReason: false });
    assert.equal(validateOutcomeReason('won', '', r).ok, true);
  });

  it('errors when a required reason is missing', () => {
    const res = validateOutcomeReason('lost', '   ', rules());
    assert.equal(res.ok, false);
    assert.match(res.error ?? '', /loss reason is required/i);
  });

  it('accepts an allowed option value (case-insensitive)', () => {
    assert.equal(validateOutcomeReason('won', 'PRICE', rules()).ok, true);
    assert.equal(
      validateOutcomeReason('lost', 'too_expensive', rules()).ok,
      true,
    );
  });

  it('rejects a value not in the configured option list', () => {
    const res = validateOutcomeReason('won', 'gut feeling', rules());
    assert.equal(res.ok, false);
    assert.match(res.error ?? '', /not an allowed win reason/i);
  });

  it('accepts any non-empty reason when no option list is configured', () => {
    const r = rules({ winReasonOptions: [] });
    assert.equal(validateOutcomeReason('won', 'anything goes', r).ok, true);
  });
});
