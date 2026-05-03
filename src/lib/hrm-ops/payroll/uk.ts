/**
 * UK payroll calculator (TY 2025-26).
 *
 * - PAYE income tax: personal allowance £12,570 (tapered above £100k),
 *   basic 20% to £50,270, higher 40% to £125,140, additional 45% above.
 * - National Insurance (Class 1):
 *     Employee — 8% on weekly wages between PT (£242/w) and UEL (£967/w),
 *                2% above UEL.
 *     Employer — 15% on weekly wages above ST (£96/w) (April 2025 rate).
 * - Optional pension contribution (auto-enrolment minimum 5% employee /
 *   3% employer of qualifying earnings).
 * - Student loan deductions per plan thresholds.
 */

import type { Payslip, PayrollInput, PayslipLine } from '../types';

const PERSONAL_ALLOWANCE = 12_570;
const PA_TAPER_START = 100_000;

const PAYE_BANDS: Array<{ upTo: number; rate: number }> = [
  { upTo: 50_270, rate: 0.2 },
  { upTo: 125_140, rate: 0.4 },
  { upTo: Infinity, rate: 0.45 },
];

// NI thresholds (annualised from weekly figures)
const NI_PT = 12_570; // primary threshold
const NI_UEL = 50_270; // upper earnings limit
const NI_ST = 5_000; // secondary threshold (employer)
const NI_EMP_RATE_LOW = 0.08;
const NI_EMP_RATE_HIGH = 0.02;
const NI_ER_RATE = 0.15;

const STUDENT_LOAN: Record<string, { threshold: number; rate: number }> = {
  none: { threshold: Infinity, rate: 0 },
  plan1: { threshold: 26_065, rate: 0.09 },
  plan2: { threshold: 28_470, rate: 0.09 },
  plan4: { threshold: 32_745, rate: 0.09 },
  plan5: { threshold: 25_000, rate: 0.09 },
  postgrad: { threshold: 21_000, rate: 0.06 },
};

function applyBands(taxable: number, bands: typeof PAYE_BANDS): number {
  if (taxable <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const { upTo, rate } of bands) {
    if (taxable <= prev) break;
    const top = Math.min(taxable, upTo);
    tax += (top - prev) * rate;
    prev = upTo;
    if (taxable <= upTo) break;
  }
  return tax;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculatePayrollUK(input: PayrollInput): Payslip {
  const {
    employeeId,
    period,
    grossAnnual,
    workedDays,
    totalDays,
    bonus = 0,
    variablePay = 0,
    pensionContribPct = 0.05,
    studentLoanPlan = 'none',
    oneOffDeductions = 0,
  } = input;

  const proration = totalDays > 0 ? Math.min(1, Math.max(0, workedDays / totalDays)) : 1;
  const periodGross = (grossAnnual / 12) * proration + bonus + variablePay;
  const annualisedGross = periodGross * 12;

  // Pension on qualifying earnings (annual)
  const pensionAnnual = Math.max(0, annualisedGross - NI_PT) * pensionContribPct;
  const pensionMonthly = pensionAnnual / 12;
  const employerPensionMonthly = (Math.max(0, annualisedGross - NI_PT) * 0.03) / 12;

  // Personal allowance taper
  const taperedPA =
    annualisedGross <= PA_TAPER_START
      ? PERSONAL_ALLOWANCE
      : Math.max(0, PERSONAL_ALLOWANCE - (annualisedGross - PA_TAPER_START) / 2);

  const taxableAnnual = Math.max(0, annualisedGross - taperedPA - pensionAnnual);
  const payeAnnual = applyBands(taxableAnnual, PAYE_BANDS);
  const payeMonthly = payeAnnual / 12;

  // NI employee — 8% PT..UEL, 2% above
  const niLowBand = Math.max(0, Math.min(annualisedGross, NI_UEL) - NI_PT);
  const niHighBand = Math.max(0, annualisedGross - NI_UEL);
  const niEmpAnnual = niLowBand * NI_EMP_RATE_LOW + niHighBand * NI_EMP_RATE_HIGH;
  const niEmpMonthly = niEmpAnnual / 12;

  // NI employer
  const niErAnnual = Math.max(0, annualisedGross - NI_ST) * NI_ER_RATE;
  const niErMonthly = niErAnnual / 12;

  // Student loan
  const sl = STUDENT_LOAN[studentLoanPlan] ?? STUDENT_LOAN.none;
  const slAnnual = Math.max(0, annualisedGross - sl.threshold) * sl.rate;
  const slMonthly = slAnnual / 12;

  const earnings: PayslipLine[] = [
    {
      code: 'BASIC',
      label: 'Basic Pay',
      amount: round2((grossAnnual / 12) * proration),
      category: 'earning',
    },
  ];
  if (bonus) earnings.push({ code: 'BONUS', label: 'Bonus', amount: round2(bonus), category: 'earning' });
  if (variablePay) earnings.push({ code: 'VAR', label: 'Variable Pay', amount: round2(variablePay), category: 'earning' });

  const taxes: PayslipLine[] = [
    { code: 'PAYE', label: 'Income Tax (PAYE)', amount: round2(payeMonthly), category: 'tax' },
    { code: 'NI_EMP', label: 'National Insurance', amount: round2(niEmpMonthly), category: 'tax' },
  ];
  if (slMonthly > 0)
    taxes.push({ code: 'SL', label: `Student Loan (${studentLoanPlan})`, amount: round2(slMonthly), category: 'tax' });

  const deductions: PayslipLine[] = [];
  if (pensionMonthly > 0)
    deductions.push({ code: 'PENSION', label: 'Pension (Employee)', amount: round2(pensionMonthly), category: 'deduction' });
  if (oneOffDeductions)
    deductions.push({ code: 'MISC', label: 'Other Deductions', amount: round2(oneOffDeductions), category: 'deduction' });

  const employerContributions: PayslipLine[] = [
    { code: 'NI_ER', label: 'Employer NI (15%)', amount: round2(niErMonthly), category: 'employer' },
    { code: 'PEN_ER', label: 'Employer Pension', amount: round2(employerPensionMonthly), category: 'employer' },
  ];

  const grossPay = round2(earnings.reduce((s, l) => s + l.amount, 0));
  const totalDeductions = round2(
    deductions.reduce((s, l) => s + l.amount, 0) + taxes.reduce((s, l) => s + l.amount, 0),
  );
  const netPay = round2(grossPay - totalDeductions);

  return {
    id: `payslip_${employeeId}_${period}`,
    tenantId: '',
    employeeId,
    period,
    country: 'UK',
    currency: 'GBP',
    earnings,
    deductions,
    taxes,
    employerContributions,
    grossPay,
    totalDeductions,
    netPay,
    meta: { taperedPersonalAllowance: round2(taperedPA), payeAnnual: round2(payeAnnual) },
  };
}
