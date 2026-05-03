/**
 * Payroll calculator registry — resolves a country code to its calculator.
 * Falls back to the EU skeleton when no specific implementation exists.
 */

import type { Country, Payslip, PayrollInput } from '../types';
import { calculatePayrollIN } from './india';
import { calculatePayrollUS } from './us';
import { calculatePayrollUK } from './uk';
import { calculatePayrollEU } from './eu';

export type PayrollCalculator = (input: PayrollInput) => Payslip;

const REGISTRY: Partial<Record<Country, PayrollCalculator>> = {
  IN: calculatePayrollIN,
  US: calculatePayrollUS,
  UK: calculatePayrollUK,
  EU: calculatePayrollEU,
};

export function getCalculator(country: Country): PayrollCalculator {
  return REGISTRY[country] ?? calculatePayrollEU;
}

export function listSupportedCountries(): Country[] {
  return Object.keys(REGISTRY) as Country[];
}
