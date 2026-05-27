/**
 * Types extracted from crm-india-eway.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface EWayBillSummary {
    _id: string;
    ewbNo: string;
    linkedInvoiceId?: string;
    ewbDate: string;
    validUpto: string;
    fromGstin: string;
    toGstin?: string;
    totalValue: number;
    distanceKm: number;
    vehicleNumber?: string;
    transporterId?: string;
    provider: string;
    status: 'active' | 'cancelled' | 'expired';
}
