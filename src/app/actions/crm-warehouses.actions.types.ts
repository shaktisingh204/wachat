/**
 * Types extracted from crm-warehouses.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface CrmWarehouseFilters {
    type?: CrmWarehouseType | '';
    status?: CrmWarehouseStatus | '';
    managerId?: string;
    country?: string;
    state?: string;
    city?: string;
    isDefault?: 'yes' | 'no' | '';
    includeArchived?: boolean;
}

export interface CrmWarehouseKpis {
    total: number;
    active: number;
    climateControlled: number;
    byType: Array<{ type: string; count: number }>;
}
