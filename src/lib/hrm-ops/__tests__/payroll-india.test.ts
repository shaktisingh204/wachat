/**
 * India payroll unit tests.
 *
 *   npx tsx --test src/lib/hrm-ops/__tests__/payroll-india.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { calculatePayrollIN } from '../payroll/india';
import { getCalculator } from '../payroll/registry';
import type { PayrollInput } from '../types';

const baseInput: PayrollInput = {
  employeeId: 'emp_1',
  period: '2026-04',
  country: 'IN',
  state: 'KA',
  grossAnnual: 1_200_000,
  workedDays: 30,
  totalDays: 30,
  taxRegime: 'new',
};

test('IN payroll: produces a payslip with required line items', () => {
  const slip = calculatePayrollIN(baseInput);
  assert.equal(slip.country, 'IN');
  assert.equal(slip.currency, 'INR');
  assert.ok(slip.earnings.find((l) => l.code === 'BASIC'));
  assert.ok(slip.earnings.find((l) => l.code === 'HRA'));
  assert.ok(slip.earnings.find((l) => l.code === 'SPECIAL'));
  assert.ok(slip.deductions.find((l) => l.code === 'PF'));
  assert.ok(slip.taxes.find((l) => l.code === 'TDS'));
});

test('IN payroll: PF capped at INR 1,800/month (12% of 15k ceiling)', () => {
  const slip = calculatePayrollIN({ ...baseInput, grossAnnual: 6_000_000 }); // very high salary
  const pf = slip.deductions.find((l) => l.code === 'PF')!;
  assert.equal(pf.amount, 1800);
});

test('IN payroll: gross + deductions reconcile to net pay', () => {
  const slip = calculatePayrollIN(baseInput);
  const expectedNet = Math.round((slip.grossPay - slip.totalDeductions) * 100) / 100;
  assert.equal(slip.netPay, expectedNet);
});

test('IN payroll: 87A rebate zeros TDS for income up to 12L (new regime)', () => {
  const slip = calculatePayrollIN({ ...baseInput, grossAnnual: 1_200_000 });
  const tds = slip.taxes.find((l) => l.code === 'TDS')!;
  assert.equal(tds.amount, 0, `expected zero TDS under 87A rebate, got ${tds.amount}`);
});

test('IN payroll: high earner (50L) pays substantial TDS', () => {
  const slip = calculatePayrollIN({ ...baseInput, grossAnnual: 5_000_000 });
  const tds = slip.taxes.find((l) => l.code === 'TDS')!;
  // ~10L+ annual tax => ~83k+/month
  assert.ok(tds.amount > 50_000, `expected meaningful TDS, got ${tds.amount}`);
});

test('IN payroll: ESI applies only when monthly gross < 21k', () => {
  const lowSalary = calculatePayrollIN({ ...baseInput, grossAnnual: 200_000 });
  assert.ok(lowSalary.deductions.find((l) => l.code === 'ESI'));

  const highSalary = calculatePayrollIN({ ...baseInput, grossAnnual: 1_200_000 });
  assert.equal(highSalary.deductions.find((l) => l.code === 'ESI'), undefined);
});

test('IN payroll: proration halves earnings when only 15/30 days worked', () => {
  const full = calculatePayrollIN(baseInput);
  const half = calculatePayrollIN({ ...baseInput, workedDays: 15 });
  const fullBasic = full.earnings.find((l) => l.code === 'BASIC')!.amount;
  const halfBasic = half.earnings.find((l) => l.code === 'BASIC')!.amount;
  // tolerate rounding
  assert.ok(Math.abs(halfBasic - fullBasic / 2) < 1, `expected ~half basic; got ${halfBasic} vs ${fullBasic}`);
});

test('IN payroll: gratuity provision appears after 5+ years of service', () => {
  const noGrat = calculatePayrollIN({ ...baseInput, yearOfService: 3 });
  assert.equal(noGrat.employerContributions.find((l) => l.code === 'GRATUITY'), undefined);
  const yesGrat = calculatePayrollIN({ ...baseInput, yearOfService: 6 });
  assert.ok(yesGrat.employerContributions.find((l) => l.code === 'GRATUITY'));
});

test('Registry resolves IN -> calculatePayrollIN', () => {
  const fn = getCalculator('IN');
  const slip = fn(baseInput);
  assert.equal(slip.country, 'IN');
});
