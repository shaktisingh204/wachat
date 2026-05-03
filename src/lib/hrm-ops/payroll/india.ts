/**
 * India payroll calculator (FY 2025-26).
 *
 * Implements the components an Indian payslip actually carries:
 *  - Basic + HRA + special allowance breakdown from CTC
 *  - Provident Fund (employee 12% + employer 12% + EPS split)
 *  - ESI (when gross monthly < 21k) — 0.75% emp / 3.25% employer
 *  - Professional tax (state-aware, capped INR 2,500/year)
 *  - Income tax (TDS) — supports NEW regime (default FY26 slabs) and OLD regime
 *  - HRA exemption (only relevant for old regime)
 *  - Gratuity (5+ years of service) — 15/26 * lastBasic * yearsOfService
 *
 * The calc returns a fully-formed `Payslip` for the period.
 */

import type {
  Payslip,
  PayrollInput,
  PayslipLine,
} from '../types';

// FY 2025-26 NEW regime slabs (₹) — annual
const NEW_REGIME_SLABS: Array<{ upTo: number; rate: number }> = [
  { upTo: 400_000, rate: 0 },
  { upTo: 800_000, rate: 0.05 },
  { upTo: 1_200_000, rate: 0.1 },
  { upTo: 1_600_000, rate: 0.15 },
  { upTo: 2_000_000, rate: 0.2 },
  { upTo: 2_400_000, rate: 0.25 },
  { upTo: Infinity, rate: 0.3 },
];

// Old regime slabs — annual (assumes age <60)
const OLD_REGIME_SLABS: Array<{ upTo: number; rate: number }> = [
  { upTo: 250_000, rate: 0 },
  { upTo: 500_000, rate: 0.05 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: Infinity, rate: 0.3 },
];

// State professional tax monthly amounts at gross >= 25k (rough, capped at 200/mo).
const PT_BY_STATE: Record<string, number> = {
  KA: 200,
  MH: 200,
  WB: 200,
  TN: 208,
  AP: 200,
  TS: 200,
  GJ: 200,
  KL: 208,
  OR: 200,
  MP: 208,
  AS: 208,
  // Union territories with no PT
  DL: 0,
  CH: 0,
  HR: 0,
  UP: 0,
};

const STANDARD_DEDUCTION_NEW = 75_000;
const STANDARD_DEDUCTION_OLD = 50_000;
const HEALTH_EDU_CESS = 0.04;
const PF_WAGE_CEILING = 15_000; // monthly basic ceiling for statutory PF
const PF_RATE = 0.12;
const EPS_RATE = 0.0833; // 8.33% of capped basic into pension
const ESI_GROSS_CEILING_MONTHLY = 21_000;
const ESI_EMP_RATE = 0.0075;
const ESI_ER_RATE = 0.0325;

function applySlabs(
  taxable: number,
  slabs: typeof NEW_REGIME_SLABS,
): number {
  if (taxable <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const { upTo, rate } of slabs) {
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

export function calculatePayrollIN(input: PayrollInput): Payslip {
  const {
    employeeId,
    period,
    state = 'KA',
    grossAnnual,
    basicPct = 0.5,
    hraPct = 0.4, // metro default
    workedDays,
    totalDays,
    bonus = 0,
    variablePay = 0,
    oneOffDeductions = 0,
    taxRegime = 'new',
    yearOfService = 0,
  } = input;

  const proration = totalDays > 0 ? Math.min(1, Math.max(0, workedDays / totalDays)) : 1;

  const basicAnnual = grossAnnual * basicPct;
  const hraAnnual = basicAnnual * hraPct; // HRA = % of basic
  const specialAnnual = grossAnnual - basicAnnual - hraAnnual;

  const basicMonthly = (basicAnnual / 12) * proration;
  const hraMonthly = (hraAnnual / 12) * proration;
  const specialMonthly = (specialAnnual / 12) * proration;

  const cappedBasicMonthly = Math.min(basicMonthly, PF_WAGE_CEILING);
  const pfEmp = cappedBasicMonthly * PF_RATE;
  const pfEmployerEps = cappedBasicMonthly * EPS_RATE;
  const pfEmployerEpf = cappedBasicMonthly * (PF_RATE - EPS_RATE);

  const grossMonthly = basicMonthly + hraMonthly + specialMonthly + bonus + variablePay;

  // ESI applicability
  const esiEmp = grossMonthly < ESI_GROSS_CEILING_MONTHLY ? grossMonthly * ESI_EMP_RATE : 0;
  const esiEr = grossMonthly < ESI_GROSS_CEILING_MONTHLY ? grossMonthly * ESI_ER_RATE : 0;

  // Professional tax
  const ptMonthly = grossMonthly >= 15_000 ? PT_BY_STATE[state] ?? 200 : 0;

  // Income tax (TDS) — annualized then divided by 12
  const stdDeduction = taxRegime === 'new' ? STANDARD_DEDUCTION_NEW : STANDARD_DEDUCTION_OLD;
  const annualPF = Math.min(basicAnnual, PF_WAGE_CEILING * 12) * PF_RATE;
  // Old regime: HRA exemption is min(actualHRA, basic*0.5(metro)/0.4, rent-10%basic)
  // We approximate by exempting full HRA when old regime selected.
  const hraExemption = taxRegime === 'old' ? hraAnnual : 0;

  const taxableAnnual = Math.max(
    0,
    grossAnnual + bonus * 12 + variablePay * 12 - stdDeduction - (taxRegime === 'old' ? annualPF : 0) - hraExemption,
  );

  const slabs = taxRegime === 'new' ? NEW_REGIME_SLABS : OLD_REGIME_SLABS;
  let annualTax = applySlabs(taxableAnnual, slabs);

  // Section 87A rebate
  if (taxRegime === 'new' && taxableAnnual <= 1_200_000) annualTax = 0;
  if (taxRegime === 'old' && taxableAnnual <= 500_000) annualTax = 0;

  annualTax *= 1 + HEALTH_EDU_CESS;
  const tdsMonthly = (annualTax / 12) * proration;

  // Gratuity provision (only after 5y service, computed as monthly accrual hint)
  const gratuityProvision = yearOfService >= 5 ? (basicMonthly * 15) / 26 / 12 : 0;

  const earnings: PayslipLine[] = [
    { code: 'BASIC', label: 'Basic', amount: round2(basicMonthly), category: 'earning' },
    { code: 'HRA', label: 'House Rent Allowance', amount: round2(hraMonthly), category: 'earning' },
    { code: 'SPECIAL', label: 'Special Allowance', amount: round2(specialMonthly), category: 'earning' },
  ];
  if (bonus) earnings.push({ code: 'BONUS', label: 'Bonus', amount: round2(bonus), category: 'earning' });
  if (variablePay)
    earnings.push({ code: 'VARIABLE', label: 'Variable Pay', amount: round2(variablePay), category: 'earning' });

  const deductions: PayslipLine[] = [
    { code: 'PF', label: 'Provident Fund (Employee)', amount: round2(pfEmp), category: 'deduction' },
  ];
  if (esiEmp > 0)
    deductions.push({ code: 'ESI', label: 'ESI (Employee)', amount: round2(esiEmp), category: 'deduction' });
  if (ptMonthly > 0)
    deductions.push({ code: 'PT', label: 'Professional Tax', amount: round2(ptMonthly), category: 'deduction' });
  if (oneOffDeductions)
    deductions.push({ code: 'MISC', label: 'Other Deductions', amount: round2(oneOffDeductions), category: 'deduction' });

  const taxes: PayslipLine[] = [
    { code: 'TDS', label: `Income Tax (TDS, ${taxRegime})`, amount: round2(tdsMonthly), category: 'tax' },
  ];

  const employerContributions: PayslipLine[] = [
    { code: 'PF_ER_EPF', label: 'PF Employer (EPF)', amount: round2(pfEmployerEpf), category: 'employer' },
    { code: 'PF_ER_EPS', label: 'PF Employer (EPS)', amount: round2(pfEmployerEps), category: 'employer' },
  ];
  if (esiEr > 0)
    employerContributions.push({ code: 'ESI_ER', label: 'ESI Employer', amount: round2(esiEr), category: 'employer' });
  if (gratuityProvision > 0)
    employerContributions.push({
      code: 'GRATUITY',
      label: 'Gratuity Provision',
      amount: round2(gratuityProvision),
      category: 'employer',
    });

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
    country: 'IN',
    currency: 'INR',
    earnings,
    deductions,
    taxes,
    employerContributions,
    grossPay,
    totalDeductions,
    netPay,
    meta: {
      taxRegime,
      proration,
      annualTaxableIncome: round2(taxableAnnual),
      annualTax: round2(annualTax),
    },
  };
}
