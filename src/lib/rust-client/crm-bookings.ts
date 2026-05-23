import 'server-only';

/**
 * CRM Booking client — wraps `/v1/crm/bookings/bookings`.
 *
 * Counterpart of the Rust crate `crm-bookings`. The Rust handlers return
 * the full `Booking` document on every endpoint; this module narrows
 * the shape into a TS-friendly `CrmBookingDoc` and provides camelCase
 * access for the UI layer.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror crm_extras_types::booking::Booking ──── */

/**
 * Booking lifecycle. Mirrors `crm_extras_types::booking::BookingStatus`
 * — multi-word variants are `snake_case` on the wire.
 */
export type CrmBookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show';

/**
 * Payment progress on the booking. Mirrors
 * `crm_extras_types::booking::PaymentStatus`.
 */
export type CrmBookingPaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';

/**
 * One scheduled reminder for the booking. `channel` is free-form
 * (`email`, `sms`, `whatsapp`, `push`, …).
 */
export interface CrmBookingReminder {
  at: string;
  channel: string;
  sent?: boolean;
}

export interface CrmBookingDoc {
  _id: string;
  // Identity (flattened on the wire — see crm_core::Identity).
  projectId?: string;
  userId?: string;
  tenantId?: string;
  // Audit (flattened on the wire — see crm_core::Audit).
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;

  resourceId: string;
  service?: string;
  customerId: string;

  slotStart: string;
  slotEnd: string;
  recurringRule?: string;
  capacityUsed: number;

  paymentStatus?: CrmBookingPaymentStatus;
  reminders?: CrmBookingReminder[];

  cancellationPolicy?: string;

  noShow?: boolean;
  status?: CrmBookingStatus;
  notes?: string;
}

export interface CrmBookingListParams {
  page?: number;
  limit?: number;
  /** Restrict to a single resource (24-char hex). */
  resourceId?: string;
  /** Restrict to a single customer (24-char hex). */
  customerId?: string;
  /** Restrict to a single lifecycle status. */
  status?: CrmBookingStatus;
  /** Inclusive lower bound on `slotStart` (ISO-8601). */
  dateFrom?: string;
  /** Exclusive upper bound on `slotStart` (ISO-8601). */
  dateTo?: string;
}

export interface CrmBookingCreateInput {
  resourceId: string;
  customerId: string;
  service?: string;
  slotStart: string;
  slotEnd: string;
  recurringRule?: string;
  capacityUsed?: number;
  paymentStatus?: CrmBookingPaymentStatus;
  cancellationPolicy?: string;
  notes?: string;
  projectId?: string;
  reminders?: CrmBookingReminder[];
}

export type CrmBookingUpdateInput = Partial<
  Omit<CrmBookingCreateInput, 'projectId'>
> & {
  reminders?: CrmBookingReminder[];
};

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmBookingListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.resourceId) qs.set('resourceId', p.resourceId);
  if (p.customerId) qs.set('customerId', p.customerId);
  if (p.status) qs.set('status', p.status);
  if (p.dateFrom) qs.set('dateFrom', p.dateFrom);
  if (p.dateTo) qs.set('dateTo', p.dateTo);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmBookingsApi = {
  list: (params?: CrmBookingListParams) =>
    rustFetch<CrmBookingDoc[]>(`/v1/crm/bookings/bookings${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmBookingDoc>(`/v1/crm/bookings/bookings/${encodeURIComponent(id)}`),
  create: (input: CrmBookingCreateInput) =>
    rustFetch<CrmBookingDoc>('/v1/crm/bookings/bookings', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmBookingUpdateInput) =>
    rustFetch<CrmBookingDoc>(`/v1/crm/bookings/bookings/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/crm/bookings/bookings/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
