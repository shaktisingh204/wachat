import 'server-only';

/**
 * SabBackstage Public Pages client — wraps `/v1/sabbackstage/public-pages`.
 *
 * Counterpart of the Rust crate `sabbackstage-public-pages`. Admin
 * CRUD over the slug → event binding + page chrome (headline, theme,
 * hero image). Also exposes the public lookup helper `publicGetBySlug`
 * used by the unauthenticated `/event/[pageSlug]` route.
 */
import { rustFetch } from './fetcher';

export type SabbackstagePublicPageStatus = 'draft' | 'live' | 'paused';

export interface SabbackstagePublicPageDoc {
  _id: string;
  userId: string;
  eventId: string;
  slug: string;
  headline: string;
  description?: string;
  themeJson?: Record<string, unknown>;
  heroImageFileId?: string;
  status: SabbackstagePublicPageStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabbackstagePublicPageListParams {
  page?: number;
  limit?: number;
  q?: string;
  eventId?: string;
  status?: SabbackstagePublicPageStatus | 'all';
}

export interface SabbackstagePublicPageListResponse {
  items: SabbackstagePublicPageDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabbackstagePublicPageCreateInput {
  eventId: string;
  slug: string;
  headline: string;
  description?: string;
  themeJson?: Record<string, unknown>;
  heroImageFileId?: string;
  status?: SabbackstagePublicPageStatus;
}

export type SabbackstagePublicPageUpdateInput = Partial<
  Omit<SabbackstagePublicPageCreateInput, 'eventId'>
>;

export interface SabbackstagePublicPageView {
  userId: string;
  eventId: string;
  page: SabbackstagePublicPageDoc;
}

function buildListQuery(p?: SabbackstagePublicPageListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.eventId) qs.set('eventId', p.eventId);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabbackstagePublicPagesApi = {
  list: (params?: SabbackstagePublicPageListParams) =>
    rustFetch<SabbackstagePublicPageListResponse>(
      `/v1/sabbackstage/public-pages${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabbackstagePublicPageDoc>(
      `/v1/sabbackstage/public-pages/${encodeURIComponent(id)}`,
    ),
  create: (input: SabbackstagePublicPageCreateInput) =>
    rustFetch<{ id: string; entity: SabbackstagePublicPageDoc }>(
      '/v1/sabbackstage/public-pages',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: SabbackstagePublicPageUpdateInput) =>
    rustFetch<SabbackstagePublicPageDoc>(
      `/v1/sabbackstage/public-pages/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabbackstage/public-pages/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  /** Public — unauthenticated. Returns only `live` pages. */
  publicGetBySlug: (slug: string) =>
    rustFetch<SabbackstagePublicPageView>(
      `/v1/sabbackstage/public-pages/public/by-slug/${encodeURIComponent(slug)}`,
    ),
};
