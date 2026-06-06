/**
 * Types extracted from crm-welcome-kits.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type CrmWelcomeKitStatus =
    | 'pending' | 'shipped' | 'delivered' | 'archived';

export interface CrmWelcomeKitItem {
    name: string;
    sku?: string;
    delivered: boolean;
    delivered_at?: string | null;
}

export interface CrmWelcomeKitDoc {
    _id: string;
    userId?: string;
    employee_id: string;
    employee_name?: string;
    items: CrmWelcomeKitItem[];
    shipping_address?: string;
    status: CrmWelcomeKitStatus;
    tracking_number?: string;
    createdAt?: string;
    updatedAt?: string;
}
