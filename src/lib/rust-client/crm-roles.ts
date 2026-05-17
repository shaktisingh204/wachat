import 'server-only';

/**
 * CRM Roles client — wraps `/v1/crm/roles`.
 *
 * Mirrors the Rust DTO in `rust/crates/crm-roles/src/{types,dto}.rs`. The
 * Rust crate persists to a top-level `crm_roles` collection keyed on
 * `userId` (== tenantUserId in our scheme). Soft-delete is via
 * `status: "archived"`.
 */
import { rustFetch } from './fetcher';

export type CrmRoleStatus = 'active' | 'archived';

export interface CrmRolePermissionFlags {
  view?: boolean;
  create?: boolean;
  edit?: boolean;
  delete?: boolean;
}

export interface CrmRoleDoc {
  _id: string;
  userId?: string;
  name: string;
  slug: string;
  displayName?: string;
  description?: string;
  isAdmin?: boolean;
  /** Map of `module_key -> { view, create, edit, delete }`. */
  permissions?: Record<string, CrmRolePermissionFlags>;
  status?: CrmRoleStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmRoleListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmRoleStatus | 'all' | 'active_visible';
}

export interface CrmRoleListResponse {
  items: CrmRoleDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmRoleCreateInput {
  name: string;
  slug?: string;
  displayName?: string;
  description?: string;
  isAdmin?: boolean;
  permissions?: Record<string, CrmRolePermissionFlags>;
}

export type CrmRoleUpdateInput = Partial<CrmRoleCreateInput> & {
  status?: CrmRoleStatus;
};

function buildListQuery(p?: CrmRoleListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmRolesApi = {
  list: (params?: CrmRoleListParams) =>
    rustFetch<CrmRoleListResponse>(
      `/v1/crm/roles${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmRoleDoc>(`/v1/crm/roles/${encodeURIComponent(id)}`),
  create: (input: CrmRoleCreateInput) =>
    rustFetch<{ id: string; entity: CrmRoleDoc }>('/v1/crm/roles', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmRoleUpdateInput) =>
    rustFetch<CrmRoleDoc>(`/v1/crm/roles/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/roles/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
