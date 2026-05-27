/**
 * Types extracted from crm-payroll-settings.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type PayrollSettings = {
  payFrequency: string;
  currency: string;
  taxRegime: string;
  pfEmployeeRate: number;
  pfEmployerRate: number;
  pfWageCeiling: number;
  esiEmployeeRate: number;
  esiEmployerRate: number;
  esiWageCeiling: number;
  pfEnabled: boolean;
  esiEnabled: boolean;
  ptEnabled: boolean;
  tdsEnabled: boolean;
  payslipTemplate: string;
  workingDaysPerWeek: number;
  overtimeEnabled: boolean;
  lateMarkingGraceMins: number;
  approvalRequired: boolean;
  approverUserId: string;
  notifyOnPayslip: boolean;
};
