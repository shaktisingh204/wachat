import 'server-only';

/**
 * CRM Departments + Designations client — wraps
 * `/v1/crm/departments` and `/v1/crm/designations`.
 *
 * Two entities in one crate (they share an org-tree concept):
 * - Department: top-level organizational unit.
 * - Designation: role within a department.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types ─── */

export interface CrmDepartmentDoc {
  _id: string;
  name: string;
  code?: string;
  parentDepartmentId?: string;
  headId?: string;
  costCenter?: string;
  description?: string;
  active?: boolean;
  color?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmDepartmentListParams {
  page?: number;
  limit?: number;
  q?: string;
}

export interface CrmDepartmentCreateInput {
  name: string;
  code?: string;
  parentDepartmentId?: string;
  headId?: string;
  costCenter?: string;
  description?: string;
  active?: boolean;
  color?: string;
}

export type CrmDepartmentUpdateInput = Partial<CrmDepartmentCreateInput>;

export interface CrmDesignationDoc {
  _id: string;
  name: string;
  code?: string;
  departmentId?: string;
  level?: number;
  grade?: string;
  minCtc?: number;
  maxCtc?: number;
  reportsToDesignationId?: string;
  description?: string;
  active?: boolean;
  color?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmDesignationListParams {
  page?: number;
  limit?: number;
  q?: string;
  departmentId?: string;
}

export interface CrmDesignationCreateInput {
  name: string;
  code?: string;
  departmentId?: string;
  level?: number;
  grade?: string;
  minCtc?: number;
  maxCtc?: number;
  reportsToDesignationId?: string;
  description?: string;
  active?: boolean;
  color?: string;
}

export type CrmDesignationUpdateInput = Partial<CrmDesignationCreateInput>;

function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const crmDepartmentsApi = {
  list: (p?: CrmDepartmentListParams) =>
    rustFetch<CrmDepartmentDoc[]>(`/v1/crm/departments${qs(p as any)}`),
  getById: (id: string) => rustFetch<CrmDepartmentDoc>(`/v1/crm/departments/${encodeURIComponent(id)}`),
  create: (input: CrmDepartmentCreateInput) =>
    rustFetch<CrmDepartmentDoc>('/v1/crm/departments', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmDepartmentUpdateInput) =>
    rustFetch<CrmDepartmentDoc>(`/v1/crm/departments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(`/v1/crm/departments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};

export const crmDesignationsApi = {
  list: (p?: CrmDesignationListParams) =>
    rustFetch<CrmDesignationDoc[]>(`/v1/crm/designations${qs(p as any)}`),
  getById: (id: string) => rustFetch<CrmDesignationDoc>(`/v1/crm/designations/${encodeURIComponent(id)}`),
  create: (input: CrmDesignationCreateInput) =>
    rustFetch<CrmDesignationDoc>('/v1/crm/designations', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmDesignationUpdateInput) =>
    rustFetch<CrmDesignationDoc>(`/v1/crm/designations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(`/v1/crm/designations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
