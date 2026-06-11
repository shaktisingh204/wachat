import 'server-only';

/**
 * SabBigin bookings client — wraps `/v1/sabbigin/bookings`.
 *
 * A booking page is a tenant-owned, publicly-bookable scheduling surface — a
 * Calendly-style page with a slug, a title, weekly availability windows, a
 * duration/buffer, and an optional intake question set. Each page is scoped to
 * the owning user and stored in `sabbigin_booking_pages`.
 */
import { rustFetch, RustApiError } from './fetcher';

export type SabbiginBookingPageStatus = 'active' | 'archived';

export interface SabbiginAvailabilityWindow {
  /** `0 = Sunday … 6 = Saturday`. */
  dow: number;
  /** `"HH:MM"`, e.g. `"09:00"`. */
  start: string;
  /** `"HH:MM"`, e.g. `"17:00"`. */
  end: string;
}

export interface SabbiginBookingQuestion {
  /** Stable machine key, e.g. `"company"`. */
  key: string;
  /** Human-facing label. */
  label: string;
  /** Must the booker answer this question? */
  required: boolean;
}

export interface SabbiginBookingPageDoc {
  _id: string;
  userId?: string;
  slug: string;
  title: string;
  description?: string | null;
  durationMin: number;
  timezone: string;
  weeklyAvailability: SabbiginAvailabilityWindow[];
  bufferMin: number;
  dateRangeDays: number;
  questions: SabbiginBookingQuestion[];
  /** Hex `ObjectId` of the CRM owner the resulting record is assigned to. */
  ownerId?: string | null;
  /** Hex `ObjectId` of the pipeline new bookings drop a deal into. */
  pipelineId?: string | null;
  confirmationMessage?: string | null;
  status: SabbiginBookingPageStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabbiginBookingPageListParams {
  page?: number;
  limit?: number;
  status?: SabbiginBookingPageStatus | 'all';
}

export interface SabbiginBookingPageListResponse {
  items: SabbiginBookingPageDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabbiginBookingPageCreateInput {
  slug: string;
  title: string;
  description?: string;
  durationMin?: number;
  timezone?: string;
  weeklyAvailability?: SabbiginAvailabilityWindow[];
  bufferMin?: number;
  dateRangeDays?: number;
  questions?: SabbiginBookingQuestion[];
  /** Hex `ObjectId`. */
  ownerId?: string;
  /** Hex `ObjectId`. */
  pipelineId?: string;
  confirmationMessage?: string;
}

export type SabbiginBookingPageUpdateInput = Partial<SabbiginBookingPageCreateInput> & {
  status?: SabbiginBookingPageStatus;
};

function buildListQuery(p?: SabbiginBookingPageListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabbiginBookingsApi = {
  list: (params?: SabbiginBookingPageListParams) =>
    rustFetch<SabbiginBookingPageListResponse>(
      `/v1/sabbigin/bookings${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabbiginBookingPageDoc>(
      `/v1/sabbigin/bookings/${encodeURIComponent(id)}`,
    ),
  /**
   * Find a tenant-owned booking page by its slug, or `null` if none exists.
   */
  getBySlug: async (slug: string): Promise<SabbiginBookingPageDoc | null> => {
    try {
      return await rustFetch<SabbiginBookingPageDoc>(
        `/v1/sabbigin/bookings/slug/${encodeURIComponent(slug)}`,
      );
    } catch (e) {
      if (e instanceof RustApiError && e.status === 404) return null;
      throw e;
    }
  },
  create: (input: SabbiginBookingPageCreateInput) =>
    rustFetch<{ id: string; entity: SabbiginBookingPageDoc }>(
      '/v1/sabbigin/bookings',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),
  update: (id: string, patch: SabbiginBookingPageUpdateInput) =>
    rustFetch<SabbiginBookingPageDoc>(
      `/v1/sabbigin/bookings/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabbigin/bookings/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
