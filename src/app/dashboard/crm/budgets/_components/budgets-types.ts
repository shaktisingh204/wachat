/**
 * Row shape consumed by the budgets list client.
 */

export interface BudgetRow {
  _id: string;
  budgetHead?: string;
  headType?: string;
  period?: string;
  planAmount?: number;
  actual?: number;
  variance?: number;
  ownerId?: string;
  ownerName?: string;
  approverId?: string;
  approverName?: string;
  scenario?: string;
  status?: string;
}
