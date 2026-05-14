import type { CrmPaymentAccount, BankAccountDetails } from '@/lib/definitions';

export interface PaymentAccountRow {
    _id: string;
    accountName: string;
    accountType: CrmPaymentAccount['accountType'];
    status: CrmPaymentAccount['status'];
    openingBalance: number;
    openingBalanceDate?: string;
    isDefault?: boolean;
    currency: string;
    bankDetails?: BankAccountDetails;
    currentBalance?: number;
    createdAt?: string;
    updatedAt?: string;
}
