/**
 * Types extracted from crm-asset-assignments.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type CrmAssetAssignmentStatus =
    | 'assigned' | 'returned' | 'lost' | 'damaged' | 'archived';

export interface CrmAssetAssignmentDoc {
    _id: string;
    userId?: string;
    asset_id: string;
    asset_name?: string;
    employee_id: string;
    employee_name?: string;
    assigned_at?: string;
    returned_at?: string | null;
    condition_at_assign?: CrmAssetCondition | string;
    condition_at_return?: CrmAssetCondition | string | null;
    notes?: string;
    status: CrmAssetAssignmentStatus;
    createdAt?: string;
    updatedAt?: string;
}
