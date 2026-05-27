/**
 * Types extracted from crm-reconciliation.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface CsvMapping {
    dateCol: string;
    descCol: string;
    debitCol: string;
    creditCol: string;
}

export interface CrmReconciliationKpis {
  reconciled: number;
  unreconciled: number;
  lastReconciledDate: string | null;
  totalDifference: number;
}
