/**
 * Types extracted from crm-item-batches.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type CrmItemBatchStatus = 'active' | 'expired' | 'recalled' | 'archived';

export interface CrmItemBatchDoc {
    _id: string;
    userId: string;
    itemId?: string;
    itemName: string;
    batchNumber: string;
    manufactureDate?: string;
    expiryDate?: string;
    quantity: number;
    unit?: string;
    locationId?: string;
    supplierId?: string;
    costPrice?: number;
    notes?: string;
    status: CrmItemBatchStatus;
    createdAt?: string;
    updatedAt?: string;
}
