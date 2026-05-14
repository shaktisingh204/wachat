export type VoucherBookType =
    | 'Contra'
    | 'Journal'
    | 'Reversing Journal'
    | 'Payment'
    | 'Receipt'
    | 'Debit Note'
    | 'Credit Note'
    | 'Sales'
    | 'Purchase'
    | 'Reimbursement';

export type VoucherResetFrequency = 'none' | 'yearly' | 'monthly';

export interface VoucherBookRow {
    _id: string;
    name: string;
    type: VoucherBookType;
    isDefault?: boolean;
    isActive?: boolean;
    approvalRequired?: boolean;
    prefix?: string;
    suffix?: string;
    startingNumber?: number;
    padding?: number;
    lastNumber?: number;
    resetFrequency?: VoucherResetFrequency;
    entryCount?: number;
    lastEntryDate?: string;
    createdAt?: string;
}

export const VOUCHER_TYPES: VoucherBookType[] = [
    'Sales',
    'Purchase',
    'Payment',
    'Receipt',
    'Contra',
    'Journal',
    'Reversing Journal',
    'Credit Note',
    'Debit Note',
    'Reimbursement',
];
