/**
 * Types extracted from crm-expense-claims.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type CrmExpenseClaimStatus =
    | 'draft' | 'submitted' | 'approved' | 'rejected' | 'reimbursed' | 'cancelled' | 'archived';

export interface CrmExpenseClaimDoc {
    _id: string;
    userId?: string;
    employee_id: string;
    employee_name?: string;
    claim_number: string;
    category_id?: string;
    category_name?: string;
    amount: number;
    currency?: string;
    expense_date?: string;
    description?: string;
    receipt_url?: string;
    receipt_name?: string;
    status: CrmExpenseClaimStatus;
    approver_id?: string;
    approver_name?: string;
    createdAt?: string;
    updatedAt?: string;
}
