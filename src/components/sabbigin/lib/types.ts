/**
 * Plain serialisable row shapes passed from SabBigin server pages into client
 * components. Server pages map Mongo docs / action results into these.
 */

export interface SabDealRow {
  _id: string;
  name: string;
  description?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  contactId?: string | null;
  contactName?: string | null;
  amount?: number | null;
  currency?: string | null;
  stage: string;
  pipelineId?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  probability?: number | null;
  expectedClose?: string | null;
  priority?: string | null;
  tags?: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface SabStage {
  id: string;
  name: string;
  color?: string | null;
  probability?: number | null;
  /** Field keys that must be non-empty before a deal may ENTER this stage. */
  requiredFields?: string[];
  /** Approval gate before entering this stage. */
  approvalRequired?: boolean;
}

export interface SabPipelineSummary {
  id: string;
  name: string;
  color?: string | null;
  isDefault?: boolean;
  stageCount: number;
}

export interface SabContactRow {
  _id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  accountId?: string | null;
  createdAt?: string | null;
}

export interface SabCompanyRow {
  _id: string;
  name: string;
  industry?: string | null;
  website?: string | null;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  category?: string | null;
  contactCount?: number;
  dealCount?: number;
  createdAt?: string | null;
}

export interface SabProductRow {
  _id: string;
  name: string;
  sku?: string | null;
  price?: number | null;
  currency?: string | null;
  description?: string | null;
}

export interface SabActivityRow {
  _id: string;
  type: string;
  title?: string | null;
  status?: string | null;
  direction?: string | null;
  dueDate?: string | null;
  contactId?: string | null;
  contactName?: string | null;
  dealId?: string | null;
  notes?: string | null;
  outcome?: string | null;
  createdAt?: string | null;
}

export type SabView = 'board' | 'list' | 'sheet' | 'calendar' | 'kanban';
