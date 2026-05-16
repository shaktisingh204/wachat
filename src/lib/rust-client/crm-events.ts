import 'server-only';

/**
 * CRM Events client — wraps `/v1/crm/events`.
 */
import { rustFetch } from './fetcher';

export type CrmEventStatus =
  | 'draft'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'archived';

export type CrmEventType =
  | 'meeting'
  | 'workshop'
  | 'social'
  | 'holiday'
  | 'celebration'
  | 'training'
  | 'conference'
  | 'other';

export interface CrmEventDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  eventType?: CrmEventType | string;
  startsAt: string;
  endsAt?: string;
  isAllDay?: boolean;
  location?: string;
  isOnline?: boolean;
  meetingUrl?: string;
  organizerId?: string;
  organizerName?: string;
  attendeeIds?: string[];
  maxAttendees?: number;
  rsvpCount?: number;
  isRecurring?: boolean;
  recurrenceRule?: string;
  parentEventId?: string;
  color?: string;
  bannerUrl?: string;
  reminderMinutes?: number;
  status: CrmEventStatus;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmEventsListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmEventStatus | 'all';
  eventType?: CrmEventType | string;
  organizerId?: string;
  /** ISO-8601 inclusive lower bound on `startsAt`. */
  dateFrom?: string;
  /** ISO-8601 inclusive upper bound on `startsAt`. */
  dateTo?: string;
}

export interface CrmEventsListResponse {
  items: CrmEventDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmEventCreateInput {
  name: string;
  description?: string;
  eventType?: CrmEventType | string;
  startsAt: string;
  endsAt?: string;
  isAllDay?: boolean;
  location?: string;
  isOnline?: boolean;
  meetingUrl?: string;
  organizerId?: string;
  organizerName?: string;
  attendeeIds?: string[];
  maxAttendees?: number;
  isRecurring?: boolean;
  recurrenceRule?: string;
  parentEventId?: string;
  color?: string;
  bannerUrl?: string;
  reminderMinutes?: number;
  tags?: string[];
}

export type CrmEventUpdateInput = Partial<CrmEventCreateInput> & {
  status?: CrmEventStatus;
  rsvpCount?: number;
};

function buildListQuery(p?: CrmEventsListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.eventType) qs.set('eventType', p.eventType);
  if (p.organizerId) qs.set('organizerId', p.organizerId);
  if (p.dateFrom) qs.set('dateFrom', p.dateFrom);
  if (p.dateTo) qs.set('dateTo', p.dateTo);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmEventsApi = {
  list: (params?: CrmEventsListParams) =>
    rustFetch<CrmEventsListResponse>(
      `/v1/crm/events${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmEventDoc>(`/v1/crm/events/${encodeURIComponent(id)}`),
  create: (input: CrmEventCreateInput) =>
    rustFetch<{ id: string; entity: CrmEventDoc }>('/v1/crm/events', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmEventUpdateInput) =>
    rustFetch<CrmEventDoc>(`/v1/crm/events/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/events/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
