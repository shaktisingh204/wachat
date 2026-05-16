import 'server-only';

/**
 * CRM Announcements client — wraps `/v1/crm/announcements`.
 */
import { rustFetch } from './fetcher';

export type CrmAnnouncementStatus =
  | 'draft'
  | 'scheduled'
  | 'published'
  | 'archived';

export type CrmAnnouncementCategory =
  | 'general'
  | 'hr'
  | 'policy'
  | 'event'
  | 'celebration'
  | 'urgent';

export type CrmAnnouncementPriority = 'low' | 'normal' | 'high' | 'urgent';

export type CrmAnnouncementAudience = 'all' | 'department' | 'team' | 'role';

export interface CrmAnnouncementDoc {
  _id: string;
  userId?: string;
  title: string;
  body: string;
  category?: CrmAnnouncementCategory | string;
  priority: CrmAnnouncementPriority | string;
  audience?: CrmAnnouncementAudience | string;
  audienceIds?: string[];
  publishAt?: string;
  expiresAt?: string;
  pinned?: boolean;
  allowComments?: boolean;
  requireAcknowledgement?: boolean;
  acknowledgementCount?: number;
  viewCount?: number;
  bannerUrl?: string;
  authorId?: string;
  authorName?: string;
  status: CrmAnnouncementStatus;
  publishedAt?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmAnnouncementListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmAnnouncementStatus | 'all';
  category?: CrmAnnouncementCategory | string;
  audience?: CrmAnnouncementAudience | string;
  pinned?: boolean;
}

export interface CrmAnnouncementListResponse {
  items: CrmAnnouncementDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmAnnouncementCreateInput {
  title: string;
  body: string;
  category?: CrmAnnouncementCategory | string;
  priority?: CrmAnnouncementPriority | string;
  audience?: CrmAnnouncementAudience | string;
  audienceIds?: string[];
  publishAt?: string;
  expiresAt?: string;
  pinned?: boolean;
  allowComments?: boolean;
  requireAcknowledgement?: boolean;
  bannerUrl?: string;
  authorId?: string;
  authorName?: string;
  status?: CrmAnnouncementStatus;
  tags?: string[];
}

export type CrmAnnouncementUpdateInput = Partial<CrmAnnouncementCreateInput> & {
  acknowledgementCount?: number;
  viewCount?: number;
};

function buildListQuery(p?: CrmAnnouncementListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.category) qs.set('category', p.category);
  if (p.audience) qs.set('audience', p.audience);
  if (p.pinned != null) qs.set('pinned', String(p.pinned));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmAnnouncementsApi = {
  list: (params?: CrmAnnouncementListParams) =>
    rustFetch<CrmAnnouncementListResponse>(
      `/v1/crm/announcements${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmAnnouncementDoc>(
      `/v1/crm/announcements/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmAnnouncementCreateInput) =>
    rustFetch<{ id: string; entity: CrmAnnouncementDoc }>(
      '/v1/crm/announcements',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmAnnouncementUpdateInput) =>
    rustFetch<CrmAnnouncementDoc>(
      `/v1/crm/announcements/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/announcements/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
