import 'server-only';

/**
 * SabTables Workspaces client — wraps `/v1/sabtables/workspaces`.
 * Mirrors `rust/crates/sabtables-workspaces/src/types.rs`.
 */
import { rustFetch } from './fetcher';

export type SabtablesWorkspaceStatus = 'active' | 'archived';

export interface SabtablesWorkspaceDoc {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  memberUserIds?: string[];
  status: SabtablesWorkspaceStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabtablesWorkspaceListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: SabtablesWorkspaceStatus | 'all';
}

export interface SabtablesWorkspaceListResponse {
  items: SabtablesWorkspaceDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabtablesWorkspaceCreateInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  memberUserIds?: string[];
}

export type SabtablesWorkspaceUpdateInput = Partial<SabtablesWorkspaceCreateInput> & {
  status?: SabtablesWorkspaceStatus;
};

function buildQuery(p?: SabtablesWorkspaceListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabtablesWorkspacesApi = {
  list: (params?: SabtablesWorkspaceListParams) =>
    rustFetch<SabtablesWorkspaceListResponse>(
      `/v1/sabtables/workspaces${buildQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabtablesWorkspaceDoc>(
      `/v1/sabtables/workspaces/${encodeURIComponent(id)}`,
    ),
  create: (input: SabtablesWorkspaceCreateInput) =>
    rustFetch<{ id: string; entity: SabtablesWorkspaceDoc }>(
      '/v1/sabtables/workspaces',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: SabtablesWorkspaceUpdateInput) =>
    rustFetch<SabtablesWorkspaceDoc>(
      `/v1/sabtables/workspaces/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabtables/workspaces/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
