/**
 * EU payroll calculator skeleton.
 *
 * EU is not a single tax jurisdiction, so this is a generic skeleton that
 * applies a flat-rate employee income tax + flat employee + employer social
 * contribution. Country-specific calculators (DE, FR, NL, ES, IT, …) should
 * override this in their own modules. The shape mirrors the IN/US/UK
 * calculators so it can drop into the registry cleanly.
 */

import type { Payslip, PayrollInput, PayslipLine } from '../types';

interface EuProfile {
  incomeTaxRate: number;
  socialEmployeeRate: number;
  socialEmployerRate: number;
  currency: 'EUR';
}

const COUNTRY_PROFILES: Record<string, EuProfile> = {
  DE: { incomeTaxRate: 0.42, socialEmployeeRate: 0.205, socialEmployerRate: 0.21, currency: 'EUR' },
  FR: { incomeTaxRate: 0.3, socialEmployeeRate: 0.22, socialEmployerRate: 0.42, currency: 'EUR' },
  NL: { incomeTaxRate: 0.3697, socialEmployeeRate: 0.275, socialEmployerRate: 0.18, currency: 'EUR' },
  ES: { incomeTaxRate: 0.3, socialEmployeeRate: 0.0635, socialEmployerRate: 0.298, currency: 'EUR' },
  IT: { incomeTaxRate: 0.35, socialEmployeeRate: 0.0919, socialEmployerRate: 0.3, currency: 'EUR' },
  IE: { incomeTaxRate: 0.4, socialEmployeeRate: 0.04, socialEmployerRate: 0.1115, currency: 'EUR' },
  DEFAULT: { incomeTaxRate: 0.3, socialEmployeeRate: 0.15, socialEmployerRate: 0.2, currency: 'EUR' },
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculatePayrollEU(input: PayrollInput): Payslip {
  const {
    employeeId,
    period,
    state = 'DEFAULT',
    grossAnnual,
    workedDays,
    totalDays,
    bonus = 0,
    variablePay = 0,
    oneOffDeductions = 0,
  } = input;

  const profile = COUNTRY_PROFILES[state] ?? COUNTRY_PROFILES.DEFAULT;
  const proration = totalDays > 0 ? Math.min(1, Math.max(0, workedDays / totalDays)) : 1;
  const periodGross = (grossAnnual / 12) * proration + bonus + variablePay;

  const tax = periodGross * profile.incomeTaxRate;
  const socialEmp = periodGross * profile.socialEmployeeRate;
  const socialEr = periodGross * profile.socialEmployerRate;

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
    { code: 'IT', label: 'Income Tax', amount: round2(tax), category: 'tax' },
  ];
  const deductions: PayslipLine[] = [
    { code: 'SOC', label: 'Social Security (Employee)', amount: round2(socialEmp), category: 'deduction' },
  ];
  if (oneOffDeductions)
    deductions.push({ code: 'MISC', label: 'Other Deductions', amount: round2(oneOffDeductions), category: 'deduction' });

  const employerContributions: PayslipLine[] = [
    { code: 'SOC_ER', label: 'Social Security (Employer)', amount: round2(socialEr), category: 'employer' },
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
    country: 'EU',
    currency: profile.currency,
    earnings,
    deductions,
    taxes,
    employerContributions,
    grossPay,
    totalDeductions,
    netPay,
    meta: { profile: state },
  };
}
