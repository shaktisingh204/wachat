import 'server-only';

/**
 * CRM Dashboards client — wraps `/v1/crm/dashboards`.
 *
 * Per-user customizable dashboards: name + description + flexible layout +
 * widgets list + scope (`private` | `shared`) + default flag.
 */
import { rustFetch } from './fetcher';

export type CrmDashboardStatus = 'active' | 'archived';
export type CrmDashboardScope = 'private' | 'shared';

/**
 * `layout` and `widgets` are intentionally permissive — they're free-form
 * JSON blobs (RGL grid layout, widget settings, etc.) that the Rust BFF
 * stores verbatim as `bson::Document` / `Vec<bson::Document>`.
 */
export type CrmDashboardLayout = Record<string, unknown>;
export type CrmDashboardWidget = Record<string, unknown>;

export interface CrmDashboardDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  layout?: CrmDashboardLayout;
  widgets?: CrmDashboardWidget[];
  isDefault?: boolean;
  scope?: CrmDashboardScope;
  ownerId?: string;
  status: CrmDashboardStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmDashboardListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmDashboardStatus | 'active_visible' | 'all';
  scope?: CrmDashboardScope;
  isDefault?: boolean;
}

export interface CrmDashboardListResponse {
  items: CrmDashboardDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmDashboardCreateInput {
  name: string;
  description?: string;
  layout?: CrmDashboardLayout;
  widgets?: CrmDashboardWidget[];
  isDefault?: boolean;
  scope?: CrmDashboardScope;
  ownerId?: string;
}

export type CrmDashboardUpdateInput = Partial<CrmDashboardCreateInput> & {
  status?: CrmDashboardStatus;
};

function buildListQuery(p?: CrmDashboardListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.scope) qs.set('scope', p.scope);
  if (p.isDefault != null) qs.set('isDefault', String(p.isDefault));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmDashboardsApi = {
  list: (params?: CrmDashboardListParams) =>
    rustFetch<CrmDashboardListResponse>(
      `/v1/crm/dashboards${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmDashboardDoc>(
      `/v1/crm/dashboards/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmDashboardCreateInput) =>
    rustFetch<{ id: string; entity: CrmDashboardDoc }>(
      '/v1/crm/dashboards',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmDashboardUpdateInput) =>
    rustFetch<CrmDashboardDoc>(
      `/v1/crm/dashboards/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/dashboards/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
