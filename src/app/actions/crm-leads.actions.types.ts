/**
 * Types extracted from crm-leads.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface CrmLeadKpis {
    total: number;
    newCount: number;
    qualifiedCount: number;
    wonCount: number;
    archivedCount: number;
    conversionRate: number; // 0..100
}

export interface CrmLeadRelatedCounts {
    deals: number;
    tasks: number;
    tickets: number;
    quotations: number;
}
