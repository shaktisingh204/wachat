/**
 * Unit tests for the formula PURE evaluator (`../formula`).
 *   npx tsx --test src/lib/sabcrm/__tests__/formula.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formulaVariables,
  evaluateFormula,
  coerceFormulaOutput,
} from '../formula';

describe('formulaVariables', () => {
  it('extracts referenced sibling field keys', () => {
    assert.deepEqual(formulaVariables('quantity * unitPrice').sort(), [
      'quantity',
      'unitPrice',
    ]);
    assert.deepEqual(formulaVariables('amount * 0.1'), ['amount']);
  });
  it('returns [] for an unparseable expression', () => {
    assert.deepEqual(formulaVariables('* * ('), []);
  });
});

describe('evaluateFormula NUMBER', () => {
  it('evaluates arithmetic over numeric fields', () => {
    const r = evaluateFormula(
      { expression: 'quantity * unitPrice', outputType: 'NUMBER' },
      { quantity: 3, unitPrice: 10 },
    );
    assert.equal(r.ok, true);
    assert.equal(r.value, 30);
  });
  it('coerces numeric strings + currency objects; missing → 0', () => {
    assert.equal(
      evaluateFormula({ expression: 'amount * 0.1', outputType: 'NUMBER' }, { amount: '250' })
        .value,
      25,
    );
    assert.equal(
      evaluateFormula({ expression: 'amount', outputType: 'NUMBER' }, { amount: { amountMicros: 5_000_000 } }).value,
      5,
    );
    assert.equal(
      evaluateFormula({ expression: 'a + b', outputType: 'NUMBER' }, { a: 2 }).value,
      2, // b missing → 0
    );
  });
  it('rounds to 6 dp', () => {
    const r = evaluateFormula({ expression: '1/3', outputType: 'NUMBER' }, {});
    assert.equal(r.value, 0.333333);
  });
});

describe('evaluateFormula BOOLEAN', () => {
  it('coerces comparisons to boolean', () => {
    assert.equal(
      evaluateFormula({ expression: 'amount > 100', outputType: 'BOOLEAN' }, { amount: 250 }).value,
      true,
    );
    assert.equal(
      evaluateFormula({ expression: 'amount > 100', outputType: 'BOOLEAN' }, { amount: 50 }).value,
      false,
    );
  });
});

describe('evaluateFormula errors', () => {
  it('empty expression → not ok', () => {
    assert.equal(evaluateFormula({ expression: '  ', outputType: 'NUMBER' }, {}).ok, false);
  });
  it('unparseable expression → not ok (never throws)', () => {
    const r = evaluateFormula({ expression: 'a +', outputType: 'NUMBER' }, { a: 1 });
    assert.equal(r.ok, false);
    assert.ok(typeof r.error === 'string');
  });
});

describe('coerceFormulaOutput', () => {
  it('NUMBER rejects non-finite', () => {
    assert.equal(coerceFormulaOutput(Infinity, 'NUMBER').ok, false);
    assert.equal(coerceFormulaOutput(42, 'NUMBER').value, 42);
  });
  it('TEXT stringifies; BOOLEAN truthifies', () => {
    assert.equal(coerceFormulaOutput(42, 'TEXT').value, '42');
    assert.equal(coerceFormulaOutput(0, 'BOOLEAN').value, false);
    assert.equal(coerceFormulaOutput(1, 'BOOLEAN').value, true);
  });
});
