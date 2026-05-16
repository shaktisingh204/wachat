import 'server-only';

/**
 * CRM Portal Users client — wraps `/v1/crm/portal-users`.
 *
 * Portal users are customer-facing logins linked to a CRM contact / account.
 * Credential material (passwords, magic-link tokens, sessions) is handled by
 * a separate auth path and is intentionally absent from this surface.
 */
import { rustFetch } from './fetcher';

export type CrmPortalUserRole = 'viewer' | 'editor' | 'admin';
export type CrmPortalUserStatus = 'active' | 'disabled' | 'archived';

export interface CrmPortalUserDoc {
  _id: string;
  userId?: string;
  name: string;
  email: string;
  contactId?: string;
  accountId?: string;
  role: CrmPortalUserRole;
  status: CrmPortalUserStatus;
  lastLoginAt?: string;
  inviteSentAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmPortalUsersListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmPortalUserStatus | 'all' | 'active_visible';
  role?: CrmPortalUserRole;
  contactId?: string;
  accountId?: string;
}

export interface CrmPortalUsersListResponse {
  items: CrmPortalUserDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmPortalUserCreateInput {
  name: string;
  email: string;
  contactId?: string;
  accountId?: string;
  role?: CrmPortalUserRole;
  status?: CrmPortalUserStatus;
  inviteSentAt?: string;
}

export type CrmPortalUserUpdateInput = Partial<CrmPortalUserCreateInput> & {
  lastLoginAt?: string;
};

function buildListQuery(p?: CrmPortalUsersListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.role) qs.set('role', p.role);
  if (p.contactId) qs.set('contactId', p.contactId);
  if (p.accountId) qs.set('accountId', p.accountId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmPortalUsersApi = {
  list: (params?: CrmPortalUsersListParams) =>
    rustFetch<CrmPortalUsersListResponse>(
      `/v1/crm/portal-users${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmPortalUserDoc>(
      `/v1/crm/portal-users/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmPortalUserCreateInput) =>
    rustFetch<{ id: string; entity: CrmPortalUserDoc }>(
      '/v1/crm/portal-users',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmPortalUserUpdateInput) =>
    rustFetch<CrmPortalUserDoc>(
      `/v1/crm/portal-users/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/portal-users/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
