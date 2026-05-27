import 'server-only';

/**
 * SabBackstage Tickets client — wraps `/v1/sabbackstage/tickets`.
 *
 * Counterpart of the Rust crate `sabbackstage-tickets`. Admin CRUD +
 * check-in over issued seats. Also exposes the public per-order
 * lookup helper `publicListByOrder` used by `/event/[slug]/tickets/[orderId]`.
 */
import { rustFetch } from './fetcher';

export type SabbackstageTicketStatus =
  | 'issued'
  | 'checked_in'
  | 'cancelled';

export interface SabbackstageTicketDoc {
  _id: string;
  userId: string;
  typeId: string;
  eventId: string;
  orderId: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone?: string;
  qrCode: string;
  status: SabbackstageTicketStatus;
  issuedAt: string;
  checkedInAt?: string;
  checkedInBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabbackstageTicketListParams {
  page?: number;
  limit?: number;
  q?: string;
  eventId?: string;
  typeId?: string;
  orderId?: string;
  status?: SabbackstageTicketStatus | 'all';
}

export interface SabbackstageTicketListResponse {
  items: SabbackstageTicketDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabbackstageTicketIssueInput {
  typeId: string;
  eventId: string;
  orderId: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone?: string;
  qrCode: string;
}

export interface SabbackstageTicketUpdateInput {
  attendeeName?: string;
  attendeeEmail?: string;
  attendeePhone?: string;
  status?: SabbackstageTicketStatus;
}

export interface SabbackstageCheckInResponse {
  ok: boolean;
  ticket: SabbackstageTicketDoc;
  alreadyCheckedIn: boolean;
}

function buildListQuery(p?: SabbackstageTicketListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.eventId) qs.set('eventId', p.eventId);
  if (p.typeId) qs.set('typeId', p.typeId);
  if (p.orderId) qs.set('orderId', p.orderId);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabbackstageTicketsApi = {
  list: (params?: SabbackstageTicketListParams) =>
    rustFetch<SabbackstageTicketListResponse>(
      `/v1/sabbackstage/tickets${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabbackstageTicketDoc>(
      `/v1/sabbackstage/tickets/${encodeURIComponent(id)}`,
    ),
  /** Issue a single ticket (one row per seat). The order flow loops over qty. */
  issue: (input: SabbackstageTicketIssueInput) =>
    rustFetch<{ id: string; entity: SabbackstageTicketDoc }>(
      '/v1/sabbackstage/tickets',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: SabbackstageTicketUpdateInput) =>
    rustFetch<SabbackstageTicketDoc>(
      `/v1/sabbackstage/tickets/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabbackstage/tickets/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  checkIn: (qrCode: string) =>
    rustFetch<SabbackstageCheckInResponse>(
      '/v1/sabbackstage/tickets/check-in',
      { method: 'POST', body: JSON.stringify({ qrCode }) },
    ),
  /** Public — unauthenticated. Lists all issued tickets on an order. */
  publicListByOrder: (orderId: string) =>
    rustFetch<SabbackstageTicketDoc[]>(
      `/v1/sabbackstage/tickets/public/by-order/${encodeURIComponent(orderId)}`,
    ),
};
