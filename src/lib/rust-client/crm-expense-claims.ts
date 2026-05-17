import 'server-only';

/**
 * CRM Expense Claims client — wraps `/v1/crm/expense-claims`.
 *
 * Field names are snake_case to match the Rust crate's on-disk BSON shape
 * (`crm-expense-claims` crate uses `#[serde(rename_all = "snake_case")]`
 * on its create/update DTOs). The wire contract wins over TS convention.
 */
import { rustFetch } from './fetcher';

export type CrmExpenseClaimStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'reimbursed'
  | 'cancelled'
  | 'archived';

export interface CrmExpenseClaimDoc {
  _id: string;
  userId?: string;
  employee_id: string;
  employee_name?: string;
  /** Auto-generated `EC-YYYYMM-NNNN` on create (Rust side). */
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

export interface CrmExpenseClaimListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmExpenseClaimStatus | 'all';
  employeeId?: string;
  categoryId?: string;
}

export interface CrmExpenseClaimListResponse {
  items: CrmExpenseClaimDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmExpenseClaimCreateInput {
  employee_id: string;
  employee_name?: string;
  /** Optional explicit override; otherwise auto-generated on Rust side. */
  claim_number?: string;
  category_id?: string;
  category_name?: string;
  amount: number;
  currency?: string;
  /** RFC3339 date-time string. */
  expense_date?: string;
  description?: string;
  receipt_url?: string;
  receipt_name?: string;
  status?: CrmExpenseClaimStatus;
  approver_id?: string;
  approver_name?: string;
}

export type CrmExpenseClaimUpdateInput = Partial<
  Omit<CrmExpenseClaimCreateInput, 'employee_id' | 'amount'>
> & {
  employee_id?: string;
  amount?: number;
};

function buildListQuery(p?: CrmExpenseClaimListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.employeeId) qs.set('employeeId', p.employeeId);
  if (p.categoryId) qs.set('categoryId', p.categoryId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmExpenseClaimsApi = {
  list: (params?: CrmExpenseClaimListParams) =>
    rustFetch<CrmExpenseClaimListResponse>(
      `/v1/crm/expense-claims${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmExpenseClaimDoc>(
      `/v1/crm/expense-claims/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmExpenseClaimCreateInput) =>
    rustFetch<{ id: string; entity: CrmExpenseClaimDoc }>(
      '/v1/crm/expense-claims',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmExpenseClaimUpdateInput) =>
    rustFetch<CrmExpenseClaimDoc>(
      `/v1/crm/expense-claims/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/expense-claims/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
