/**
 * Types extracted from crm-bom.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface CrmBomComponent {
  itemId?: string;
  itemName: string;
  qty: number;
  unit: string;
  scrapPct: number;
  optional?: boolean;
  costPerUnit?: number;
}

export interface CrmBomDoc {
  _id: ObjectId | string;
  userId: ObjectId | string;
  bomNo: string;
  finishedGoodName: string;
  finishedGoodId?: ObjectId | string;
  outputQty: number;
  unit: string;
  effectiveDate: Date | string;
  version: string;
  notes?: string;
  status?: string;
  active?: boolean;
  components: CrmBomComponent[];
  labourCost?: number;
  overheadCost?: number;
  totalCost?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CrmBomKpis {
  active: number;
  finishedGoodsCovered: number;
  avgCost: number;
  versionsCount: number;
}
