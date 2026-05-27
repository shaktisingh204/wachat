/**
 * Types extracted from crm-travel.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type CrmTravelStatus =

export interface CrmTravelRequestDoc {
    _id: string;
    userId?: string;
    employee_id: string;
    employee_name?: string;
    purpose?: string;
    from_city?: string;
    to_city?: string;
    mode?: CrmTravelMode | string;
    travel_date?: string;
    return_date?: string | null;
    estimated_cost?: number;
    actual_cost?: number;
    currency?: string;
    status: CrmTravelStatus;
    approver_id?: string;
    approver_name?: string;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
}
