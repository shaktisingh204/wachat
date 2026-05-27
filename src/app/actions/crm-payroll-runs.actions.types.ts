/**
 * Types extracted from crm-payroll-runs.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type CrmPayrollRunStatus =

export interface CrmPayrollRunDoc {
    _id: string;
    userId?: string;
    period_month: number;
    period_year: number;
    run_date?: string;
    run_by?: string;
    total_employees: number;
    total_gross: number;
    total_deductions: number;
    total_net: number;
    status: CrmPayrollRunStatus;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
}
