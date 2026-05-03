/**
 * US payroll calculator (TY 2025).
 *
 * Withholdings included:
 *  - Federal income tax (post-2020 W-4 percentage method, simplified)
 *  - State income tax (flat-rate map; no-tax states zeroed)
 *  - FICA: Social Security 6.2% (wage base $176,100 in 2025) + Medicare 1.45%
 *    (+0.9% additional on wages above $200k single / $250k MFJ)
 *  - Employer FICA (matched), FUTA (0.6% effective on first $7,000) and SUTA
 *    (rate by state with $7,000+ wage base — using a representative SUTA rate).
 */

import type { Payslip, PayrollInput, PayslipLine } from '../types';

const FED_BRACKETS_SINGLE: Array<{ upTo: number; rate: number }> = [
  { upTo: 11_925, rate: 0.1 },
  { upTo: 48_475, rate: 0.12 },
  { upTo: 103_350, rate: 0.22 },
  { upTo: 197_300, rate: 0.24 },
  { upTo: 250_525, rate: 0.32 },
  { upTo: 626_350, rate: 0.35 },
  { upTo: Infinity, rate: 0.37 },
];

const FED_BRACKETS_MFJ: Array<{ upTo: number; rate: number }> = [
  { upTo: 23_850, rate: 0.1 },
  { upTo: 96_950, rate: 0.12 },
  { upTo: 206_700, rate: 0.22 },
  { upTo: 394_600, rate: 0.24 },
  { upTo: 501_050, rate: 0.32 },
  { upTo: 751_600, rate: 0.35 },
  { upTo: Infinity, rate: 0.37 },
];

const STD_DEDUCTION: Record<string, number> = {
  single: 15_000,
  married_separately: 15_000,
  married_jointly: 30_000,
  head_of_household: 22_500,
};

const SS_WAGE_BASE = 176_100; // 2025
const SS_RATE = 0.062;
const MEDICARE_RATE = 0.0145;
const ADDL_MEDICARE_RATE = 0.009;
const ADDL_MEDICARE_THRESHOLD: Record<string, number> = {
  single: 200_000,
  head_of_household: 200_000,
  married_separately: 125_000,
  married_jointly: 250_000,
};

const FUTA_BASE = 7_000;
const FUTA_RATE = 0.006;
const SUTA_BASE = 7_000;
const SUTA_DEFAULT_RATE = 0.027;

// Flat state income tax rates (top marginal, simplified).
const STATE_TAX_RATE: Record<string, number> = {
  AK: 0, FL: 0, NV: 0, NH: 0, SD: 0, TN: 0, TX: 0, WA: 0, WY: 0,
  CA: 0.093, NY: 0.0685, NJ: 0.0897, IL: 0.0495, MA: 0.05, GA: 0.0539,
  CO: 0.044, AZ: 0.025, NC: 0.0425, PA: 0.0307, OH: 0.035, VA: 0.0575,
  MI: 0.0425, OR: 0.0875, MN: 0.0985, UT: 0.0455, IN: 0.0305, MD: 0.0575,
};

const STATE_SUTA_RATE: Record<string, number> = {
  CA: 0.034, NY: 0.041, FL: 0.027, TX: 0.027, WA: 0.029, OR: 0.024,
};

function applyBrackets(taxable: number, brackets: typeof FED_BRACKETS_SINGLE): number {
  if (taxable <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const { upTo, rate } of brackets) {
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

export function calculatePayrollUS(input: PayrollInput): Payslip {
  const {
    employeeId,
    period,
    state = 'CA',
    grossAnnual,
    workedDays,
    totalDays,
    bonus = 0,
    variablePay = 0,
    oneOffDeductions = 0,
    filingStatus = 'single',
    allowances = 0,
  } = input;

  const proration = totalDays > 0 ? Math.min(1, Math.max(0, workedDays / totalDays)) : 1;

  const periodGross = (grossAnnual / 12) * proration + bonus + variablePay;
  const annualizedGross = periodGross * 12;

  // Federal income tax
  const std = STD_DEDUCTION[filingStatus] ?? STD_DEDUCTION.single;
  const taxable = Math.max(0, annualizedGross - std - allowances);
  const fedBrackets = filingStatus === 'married_jointly' ? FED_BRACKETS_MFJ : FED_BRACKETS_SINGLE;
  const fedAnnual = applyBrackets(taxable, fedBrackets);
  const fedMonthly = fedAnnual / 12;

  // State income tax
  const stateRate = STATE_TAX_RATE[state] ?? 0;
  const stateMonthly = Math.max(0, taxable * stateRate) / 12;

  // FICA — Social Security capped on wage base
  const ssWagesThisPeriod = Math.min(periodGross, Math.max(0, SS_WAGE_BASE / 12));
  const ssEmp = ssWagesThisPeriod * SS_RATE;
  const medicareEmp = periodGross * MEDICARE_RATE;
  const addlThreshold = ADDL_MEDICARE_THRESHOLD[filingStatus] ?? 200_000;
  const addlMedicare = annualizedGross > addlThreshold ? (periodGross * ADDL_MEDICARE_RATE) : 0;

  // Employer FICA, FUTA, SUTA
  const ssEr = ssWagesThisPeriod * SS_RATE;
  const medicareEr = periodGross * MEDICARE_RATE;
  // FUTA & SUTA only on first wage_base of YTD wages — approximate by spreading over Q1.
  const periodIndex = Number((period.split('-')[1] ?? '1')) - 1;
  const futaApplied = periodIndex < 3 ? Math.min(periodGross, FUTA_BASE / 3) * FUTA_RATE : 0;
  const sutaRate = STATE_SUTA_RATE[state] ?? SUTA_DEFAULT_RATE;
  const sutaApplied = periodIndex < 3 ? Math.min(periodGross, SUTA_BASE / 3) * sutaRate : 0;

  const earnings: PayslipLine[] = [
    {
      code: 'REG',
      label: 'Regular Wages',
      amount: round2((grossAnnual / 12) * proration),
      category: 'earning',
    },
  ];
  if (bonus) earnings.push({ code: 'BONUS', label: 'Bonus', amount: round2(bonus), category: 'earning' });
  if (variablePay) earnings.push({ code: 'VAR', label: 'Variable Pay', amount: round2(variablePay), category: 'earning' });

  const taxes: PayslipLine[] = [
    { code: 'FED', label: 'Federal Income Tax', amount: round2(fedMonthly), category: 'tax' },
    { code: 'SS', label: 'Social Security (6.2%)', amount: round2(ssEmp), category: 'tax' },
    { code: 'MED', label: 'Medicare (1.45%)', amount: round2(medicareEmp), category: 'tax' },
  ];
  if (addlMedicare > 0)
    taxes.push({ code: 'MED_ADDL', label: 'Addl Medicare (0.9%)', amount: round2(addlMedicare), category: 'tax' });
  if (stateMonthly > 0)
    taxes.push({ code: 'STATE', label: `State Tax (${state})`, amount: round2(stateMonthly), category: 'tax' });

  const deductions: PayslipLine[] = [];
  if (oneOffDeductions)
    deductions.push({ code: 'MISC', label: 'Other Deductions', amount: round2(oneOffDeductions), category: 'deduction' });

  const employerContributions: PayslipLine[] = [
    { code: 'SS_ER', label: 'Social Security (Employer)', amount: round2(ssEr), category: 'employer' },
    { code: 'MED_ER', label: 'Medicare (Employer)', amount: round2(medicareEr), category: 'employer' },
    { code: 'FUTA', label: 'FUTA (Federal Unemployment)', amount: round2(futaApplied), category: 'employer' },
    { code: 'SUTA', label: `SUTA (${state})`, amount: round2(sutaApplied), category: 'employer' },
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
    country: 'US',
    currency: 'USD',
    earnings,
    deductions,
    taxes,
    employerContributions,
    grossPay,
    totalDeductions,
    netPay,
    meta: { filingStatus, state, taxableAnnual: round2(taxable), fedAnnual: round2(fedAnnual) },
  };
}
