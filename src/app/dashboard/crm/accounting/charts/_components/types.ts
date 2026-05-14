/**
 * Shared types for the Chart of Accounts list / detail rebuilds.
 */

export type CoaNature = 'Asset' | 'Liability' | 'Income' | 'Expense' | 'Capital';

export interface CoaRow {
    _id: string;
    name: string;
    code?: string;
    currency: string;
    description?: string;
    status: 'Active' | 'Inactive';
    openingBalance: number;
    balanceType: 'Cr' | 'Dr';
    currentBalance?: number;
    currentBalanceType?: 'Cr' | 'Dr';
    accountGroupId: string;
    accountGroupName?: string;
    accountGroupCategory?: string;
    accountGroupType?: CoaNature;
}

export type CoaViewMode = 'table' | 'tree';
