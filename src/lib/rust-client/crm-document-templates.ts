import 'server-only';

/**
 * CRM Document Template client — wraps `/v1/crm/document-templates`.
 *
 * The Rust crate stores fields as camelCase BSON (`templateFileUrl`,
 * `isActive`, `createdAt`, `updatedAt`). `variables` are objects with
 * `{ name, label?, default? }` per `TemplateVariable`.
 */
import { rustFetch } from './fetcher';

export type CrmDocumentTemplateStatus = 'draft' | 'active' | 'archived';

export type CrmDocumentTemplateKind = 'Contract' | 'Policy' | 'Offer' | 'Other';

export interface CrmDocumentTemplateVariable {
  name: string;
  label?: string;
  default?: string;
}

export interface CrmDocumentTemplateDoc {
  _id: string;
  userId?: string;
  name: string;
  kind: CrmDocumentTemplateKind | string;
  category?: string;
  body?: string;
  variables?: CrmDocumentTemplateVariable[];
  templateFileUrl?: string;
  isActive?: boolean;
  status: CrmDocumentTemplateStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmDocumentTemplateListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmDocumentTemplateStatus | 'all';
  kind?: CrmDocumentTemplateKind | string;
  category?: string;
  isActive?: boolean;
}

export interface CrmDocumentTemplateListResponse {
  items: CrmDocumentTemplateDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmDocumentTemplateCreateInput {
  name: string;
  kind?: CrmDocumentTemplateKind | string;
  category?: string;
  body?: string;
  variables?: CrmDocumentTemplateVariable[];
  templateFileUrl?: string;
  isActive?: boolean;
  status?: CrmDocumentTemplateStatus;
}

export type CrmDocumentTemplateUpdateInput = Partial<CrmDocumentTemplateCreateInput>;

function buildListQuery(p?: CrmDocumentTemplateListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.kind) qs.set('kind', String(p.kind));
  if (p.category) qs.set('category', p.category);
  if (p.isActive != null) qs.set('isActive', String(p.isActive));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmDocumentTemplatesApi = {
  list: (params?: CrmDocumentTemplateListParams) =>
    rustFetch<CrmDocumentTemplateListResponse>(
      `/v1/crm/document-templates${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmDocumentTemplateDoc>(
      `/v1/crm/document-templates/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmDocumentTemplateCreateInput) =>
    rustFetch<{ id: string; entity: CrmDocumentTemplateDoc }>(
      '/v1/crm/document-templates',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),
  update: (id: string, patch: CrmDocumentTemplateUpdateInput) =>
    rustFetch<CrmDocumentTemplateDoc>(
      `/v1/crm/document-templates/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/document-templates/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
