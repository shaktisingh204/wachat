/**
 * Types extracted from crm-production-orders.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface CrmProductionOrderDoc {
  _id: string;
  userId: string;
  orderNo: string;
  bomRef?: string;
  bomId?: string;
  finishedGoodId?: string;
  finishedGoodName: string;
  plannedQty: number;
  actualYield?: number;
  scrap?: number;
  unit?: string;
  plannedStart?: string;
  plannedEnd?: string;
  machineId?: string;
  machineOperator?: string;
  machineOperatorId?: string;
  notes?: string;
  status: string;
  components?: CrmBomComponent[];
  componentsConsumed?: { itemName: string; planned: number; actual: number; unit?: string }[];
  labourCost?: number;
  overheadCost?: number;
  materialCost?: number;
  totalCost?: number;
  downtimeReasons?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmProductionOrderKpis {
  open: number;
  inProgress: number;
  completed: number;
  scrapRate: number;
  avgYieldPct: number;
}
