/**
 * Types extracted from crm-vendors.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface CrmVendorKpis {
    /** Total vendors for the tenant (all types). */
    total: number;
    /** Active vendors — at least one purchase order in the last 12 months. */
    active: number;
    /** Total purchase order value across all vendors, all-time, INR (or mixed currency sum). */
    totalPurchaseValue: number;
    /** Top vendor by total PO value. */
    topVendor: { name: string; value: number } | null;
    /** Currency hint for the totals — best-effort, defaults to INR. */
    currency: string;
}
