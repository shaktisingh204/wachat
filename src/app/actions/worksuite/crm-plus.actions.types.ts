/**
 * Types extracted from crm-plus.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface LeadCategoryKpis {
  total: number;
  withDeals: number;
  withLeads: number;
  mostUsed: string;
}

export interface LeadSourceKpis {
  total: number;
  withActiveLeads: number;
  topSource: string;
  topSourceLeads: number;
}

export interface LeadStatusKpis {
  total: number;
  openCount: number;
  closedCount: number;
  wonLostCount: number;
}

export interface SalesCrmConfig {
  _id?: string;
  userId?: string;
  // Pipeline
  defaultPipelineId?: string;
  autoProgression?: boolean;
  // Lead
  autoAssignLeads?: boolean;
  leadScoringEnabled?: boolean;
  defaultLeadStatusId?: string;
  // Deal
  probabilityTracking?: boolean;
  dealRotDays?: number;
  defaultCurrency?: string;
  // Notifications
  emailNotifications?: boolean;
  inAppNotifications?: boolean;
  updatedAt?: string;
}
