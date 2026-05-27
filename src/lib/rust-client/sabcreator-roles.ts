import 'server-only';

/**
 * SabCreator Roles client — wraps `/v1/sabcreator/roles`.
 * Mirrors `rust/crates/sabcreator-roles/src/types.rs`.
 */
import { rustFetch } from './fetcher';

export type SabcreatorRowLevelRuleKind = 'own' | 'all' | 'conditional';

export interface SabcreatorRowLevelRule {
  rule: SabcreatorRowLevelRuleKind;
  condition?: Record<string, unknown>;
}

export interface SabcreatorRoleDoc {
  _id: string;
  userId: string;
  appId: string;
  name: string;
  color?: string;
  recordsCanRead: SabcreatorRowLevelRule;
  recordsCanEdit: SabcreatorRowLevelRule;
  recordsCanDelete: SabcreatorRowLevelRule;
  formsCanSubmit?: string[];
  pagesCanView?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SabcreatorRoleListParams {
  page?: number;
  limit?: number;
  q?: string;
  appId?: string;
}

export interface SabcreatorRoleListResponse {
  items: SabcreatorRoleDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabcreatorRoleCreateInput {
  appId: string;
  name: string;
  color?: string;
  recordsCanRead?: SabcreatorRowLevelRule;
  recordsCanEdit?: SabcreatorRowLevelRule;
  recordsCanDelete?: SabcreatorRowLevelRule;
  formsCanSubmit?: string[];
  pagesCanView?: string[];
}

export type SabcreatorRoleUpdateInput = Partial<Omit<SabcreatorRoleCreateInput, 'appId'>>;

function buildQuery(p?: SabcreatorRoleListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.appId) qs.set('appId', p.appId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcreatorRolesApi = {
  list: (params?: SabcreatorRoleListParams) =>
    rustFetch<SabcreatorRoleListResponse>(`/v1/sabcreator/roles${buildQuery(params)}`),
  getById: (id: string) =>
    rustFetch<SabcreatorRoleDoc>(`/v1/sabcreator/roles/${encodeURIComponent(id)}`),
  create: (input: SabcreatorRoleCreateInput) =>
    rustFetch<{ id: string; entity: SabcreatorRoleDoc }>('/v1/sabcreator/roles', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SabcreatorRoleUpdateInput) =>
    rustFetch<SabcreatorRoleDoc>(`/v1/sabcreator/roles/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabcreator/roles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
