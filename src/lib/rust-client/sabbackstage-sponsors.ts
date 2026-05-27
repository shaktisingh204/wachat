import 'server-only';

/**
 * SabBackstage Sponsors client — wraps `/v1/sabbackstage/sponsors`.
 *
 * Counterpart of the Rust crate `sabbackstage-sponsors`. Admin CRUD
 * over sponsor logo + tier rows bound to a `crm_events` row. Also
 * exposes the public lookup helper `publicListByEvent` used by
 * `/event/[slug]/sponsors`.
 */
import { rustFetch } from './fetcher';

export interface SabbackstageSponsorDoc {
  _id: string;
  userId: string;
  eventId: string;
  name: string;
  tier: string;
  logoFileId?: string;
  websiteUrl?: string;
  contactEmail?: string;
  orderRank: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabbackstageSponsorListParams {
  page?: number;
  limit?: number;
  q?: string;
  eventId?: string;
  tier?: string;
}

export interface SabbackstageSponsorListResponse {
  items: SabbackstageSponsorDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabbackstageSponsorCreateInput {
  eventId: string;
  name: string;
  tier: string;
  logoFileId?: string;
  websiteUrl?: string;
  contactEmail?: string;
  orderRank?: number;
}

export type SabbackstageSponsorUpdateInput = Partial<
  Omit<SabbackstageSponsorCreateInput, 'eventId'>
>;

function buildListQuery(p?: SabbackstageSponsorListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.eventId) qs.set('eventId', p.eventId);
  if (p.tier) qs.set('tier', p.tier);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabbackstageSponsorsApi = {
  list: (params?: SabbackstageSponsorListParams) =>
    rustFetch<SabbackstageSponsorListResponse>(
      `/v1/sabbackstage/sponsors${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabbackstageSponsorDoc>(
      `/v1/sabbackstage/sponsors/${encodeURIComponent(id)}`,
    ),
  create: (input: SabbackstageSponsorCreateInput) =>
    rustFetch<{ id: string; entity: SabbackstageSponsorDoc }>(
      '/v1/sabbackstage/sponsors',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: SabbackstageSponsorUpdateInput) =>
    rustFetch<SabbackstageSponsorDoc>(
      `/v1/sabbackstage/sponsors/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabbackstage/sponsors/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  publicListByEvent: (eventId: string) =>
    rustFetch<SabbackstageSponsorDoc[]>(
      `/v1/sabbackstage/sponsors/public/by-event/${encodeURIComponent(eventId)}`,
    ),
};
