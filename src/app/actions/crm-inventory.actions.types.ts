/**
 * Types extracted from crm-inventory.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface CrmStockAdjustmentFilters {
    status?: CrmStockAdjustmentStatus | '';
    warehouseId?: string;
    reason?: string;
    approverId?: string;
    dateFrom?: string;
    dateTo?: string;
}

export interface CrmStockAdjustmentKpis {
    pending: number;
    approved: number;
    rejected: number;
    totalImpactValue: number;
}

export interface PartyTransactionsDeepKpis {
    totalParties: number;
    topParty: { name: string; volume: number } | null;
    totalDebit: number;
    totalCredit: number;
    outstandingBalance: number;
    topN: Array<{ name: string; volume: number; debit: number; credit: number }>;
}
