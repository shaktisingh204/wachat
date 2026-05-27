/**
 * Types extracted from crm-pos.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type PosPaymentMethod = 'cash' | 'card' | 'upi' | 'split' | 'other';

export type PosRefundStatus = 'pending' | 'completed' | 'failed';

export interface PosRefundDoc {
    _id: string;
    userId: string;
    originalTransactionId: string;
    originalTransactionNumber?: string | null;
    sessionId?: string | null;
    reason: string;
    refundedLineItems: PosLineItem[];
    refundTotal: number;
    refundMethod: PosPaymentMethod;
    status: PosRefundStatus;
    processedAt?: string | null;
    processedBy?: string | null;
    createdAt: string;
    updatedAt: string;
}
