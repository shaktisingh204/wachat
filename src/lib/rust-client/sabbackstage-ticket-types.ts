import 'server-only';

/**
 * SabBackstage Ticket Types client — wraps `/v1/sabbackstage/ticket-types`.
 *
 * Counterpart of the Rust crate `sabbackstage-ticket-types`. Admin
 * CRUD over ticket tiers bound to a `crm_events` row. Also exposes the
 * public lookup helper `publicListByEvent` used by the unauthenticated
 * `/event/[pageSlug]` route.
 */
import { rustFetch } from './fetcher';

export type SabbackstageTicketTypeStatus =
  | 'draft'
  | 'live'
  | 'paused'
  | 'soldout';

export interface SabbackstageTicketTypeDoc {
  _id: string;
  userId: string;
  eventId: string;
  name: string;
  description?: string;
  priceMinor: number;
  currency: string;
  capacity: number;
  soldCount: number;
  salesStartAt?: string;
  salesEndAt?: string;
  status: SabbackstageTicketTypeStatus;
  orderRank: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabbackstageTicketTypeListParams {
  page?: number;
  limit?: number;
  q?: string;
  eventId?: string;
  status?: SabbackstageTicketTypeStatus | 'all';
}

export interface SabbackstageTicketTypeListResponse {
  items: SabbackstageTicketTypeDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabbackstageTicketTypeCreateInput {
  eventId: string;
  name: string;
  description?: string;
  priceMinor?: number;
  currency?: string;
  capacity?: number;
  salesStartAt?: string;
  salesEndAt?: string;
  status?: SabbackstageTicketTypeStatus;
  orderRank?: number;
}

export type SabbackstageTicketTypeUpdateInput =
  Partial<SabbackstageTicketTypeCreateInput>;

function buildListQuery(p?: SabbackstageTicketTypeListParams): string {
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

export const sabbackstageTicketTypesApi = {
  list: (params?: SabbackstageTicketTypeListParams) =>
    rustFetch<SabbackstageTicketTypeListResponse>(
      `/v1/sabbackstage/ticket-types${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabbackstageTicketTypeDoc>(
      `/v1/sabbackstage/ticket-types/${encodeURIComponent(id)}`,
    ),
  create: (input: SabbackstageTicketTypeCreateInput) =>
    rustFetch<{ id: string; entity: SabbackstageTicketTypeDoc }>(
      '/v1/sabbackstage/ticket-types',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: SabbackstageTicketTypeUpdateInput) =>
    rustFetch<SabbackstageTicketTypeDoc>(
      `/v1/sabbackstage/ticket-types/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabbackstage/ticket-types/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  /** Public — unauthenticated. Lists `live` types for an event. */
  publicListByEvent: (eventId: string) =>
    rustFetch<SabbackstageTicketTypeDoc[]>(
      `/v1/sabbackstage/ticket-types/public/by-event/${encodeURIComponent(eventId)}`,
    ),
};
