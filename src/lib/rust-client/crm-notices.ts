import 'server-only';

/**
 * CRM Notices client — wraps `/v1/crm/notices`.
 */
import { rustFetch } from './fetcher';

export type CrmNoticeStatus =
  | 'draft'
  | 'issued'
  | 'acknowledged'
  | 'superseded'
  | 'archived';

export type CrmNoticeCategory =
  | 'general'
  | 'safety'
  | 'compliance'
  | 'closure'
  | 'meeting'
  | 'emergency';

export type CrmNoticeSeverity = 'info' | 'warning' | 'critical';

export type CrmNoticeAudience =
  | 'all'
  | 'department'
  | 'team'
  | 'role'
  | 'individual';

export interface CrmNoticeDoc {
  _id: string;
  userId?: string;
  noticeNumber: string;
  title: string;
  body: string;
  category?: CrmNoticeCategory | string;
  referenceNumber?: string;
  issuedBy?: string;
  issuedByName?: string;
  issuedTo?: CrmNoticeAudience | string;
  recipientIds?: string[];
  effectiveFrom?: string;
  effectiveUntil?: string;
  requireAcknowledgement?: boolean;
  acknowledgementCount?: number;
  severity?: CrmNoticeSeverity | string;
  attachments?: string[];
  status: CrmNoticeStatus;
  issuedAt?: string;
  supersededBy?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmNoticeListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmNoticeStatus | 'all';
  category?: CrmNoticeCategory | string;
  severity?: CrmNoticeSeverity | string;
  issuedTo?: CrmNoticeAudience | string;
}

export interface CrmNoticeListResponse {
  items: CrmNoticeDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmNoticeCreateInput {
  noticeNumber?: string;
  title: string;
  body: string;
  category?: CrmNoticeCategory | string;
  referenceNumber?: string;
  issuedBy?: string;
  issuedByName?: string;
  issuedTo?: CrmNoticeAudience | string;
  recipientIds?: string[];
  effectiveFrom?: string;
  effectiveUntil?: string;
  requireAcknowledgement?: boolean;
  severity?: CrmNoticeSeverity | string;
  attachments?: string[];
  status?: CrmNoticeStatus;
  notes?: string;
}

export type CrmNoticeUpdateInput = Partial<CrmNoticeCreateInput> & {
  acknowledgementCount?: number;
  supersededBy?: string;
};

function buildListQuery(p?: CrmNoticeListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.category) qs.set('category', p.category);
  if (p.severity) qs.set('severity', p.severity);
  if (p.issuedTo) qs.set('issuedTo', p.issuedTo);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmNoticesApi = {
  list: (params?: CrmNoticeListParams) =>
    rustFetch<CrmNoticeListResponse>(
      `/v1/crm/notices${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmNoticeDoc>(`/v1/crm/notices/${encodeURIComponent(id)}`),
  create: (input: CrmNoticeCreateInput) =>
    rustFetch<{ id: string; entity: CrmNoticeDoc }>('/v1/crm/notices', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmNoticeUpdateInput) =>
    rustFetch<CrmNoticeDoc>(`/v1/crm/notices/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/notices/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
