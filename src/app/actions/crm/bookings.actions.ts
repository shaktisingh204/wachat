'use server';

/**
 * CRM Booking server actions.
 *
 * Thin shims over the Rust BFF (`crmBookingsApi`). No direct Mongo
 * access. FormData callers (the create/edit pages) hit
 * `saveBookingAction` / `deleteBookingAction`; programmatic callers can
 * use the typed helpers (`listBookings`, `getBooking`, `createBooking`,
 * `updateBooking`, `deleteBooking`).
 *
 * Bookings are NOT in `WsCustomFieldBelongsTo` (see
 * `src/lib/worksuite/meta-types.ts`) so the custom-fields plumbing used
 * by the Lead actions is intentionally skipped here.
 */

import { revalidatePath } from 'next/cache';
import { RustApiError } from '@/lib/rust-client';
import {
  crmBookingsApi,
  type CrmBookingCreateInput,
  type CrmBookingDoc,
  type CrmBookingListParams,
  type CrmBookingPaymentStatus,
  type CrmBookingStatus,
  type CrmBookingUpdateInput,
} from '@/lib/rust-client/crm-bookings';

const LIST_PATH = '/dashboard/crm/bookings';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

export interface BookingListResult {
  bookings: CrmBookingDoc[];
  page: number;
  limit: number;
  // The Rust endpoint returns a bare array — there's no `total` field.
  // The UI uses `hasMore` to know whether to render the Next button.
  hasMore: boolean;
  error?: string;
}

export async function listBookings(
  params: CrmBookingListParams = {},
): Promise<BookingListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const bookings = await crmBookingsApi.list({ ...params, page, limit });
    return { bookings, page, limit, hasMore: bookings.length === limit };
  } catch (e) {
    return { bookings: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getBooking(
  id: string,
): Promise<{ booking: CrmBookingDoc | null; error?: string }> {
  if (!id) return { booking: null, error: 'Missing booking id.' };
  try {
    const booking = await crmBookingsApi.getById(id);
    return { booking };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { booking: null, error: 'Booking not found.' };
    }
    return { booking: null, error: rustErr(e) };
  }
}

/* ─── Write ───────────────────────────────────────────────────── */

function pickString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function pickNumber(formData: FormData, key: string): number | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const BOOKING_STATUS_VALUES: readonly CrmBookingStatus[] = [
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
] as const;

const PAYMENT_STATUS_VALUES: readonly CrmBookingPaymentStatus[] = [
  'unpaid',
  'partial',
  'paid',
  'refunded',
] as const;

function pickStatus(formData: FormData): CrmBookingStatus | undefined {
  const v = pickString(formData, 'status');
  if (!v) return undefined;
  return (BOOKING_STATUS_VALUES as readonly string[]).includes(v)
    ? (v as CrmBookingStatus)
    : undefined;
}

function pickPaymentStatus(
  formData: FormData,
): CrmBookingPaymentStatus | undefined {
  const v = pickString(formData, 'paymentStatus');
  if (!v) return undefined;
  return (PAYMENT_STATUS_VALUES as readonly string[]).includes(v)
    ? (v as CrmBookingPaymentStatus)
    : undefined;
}

/**
 * Normalize a `datetime-local` value (or any ISO-ish string) into a
 * full ISO-8601 UTC instant the Rust DTO can parse. Returns `undefined`
 * when the input is empty or unparseable.
 */
function pickDateTime(formData: FormData, key: string): string | undefined {
  const v = pickString(formData, key);
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST. Lifecycle transitions (`status`, `noShow`) are NOT editable
 * through PATCH on the Rust side — they belong to dedicated endpoints
 * (`/check-in`, `/cancel`) — so the form's `status` field is only sent
 * on create.
 */
export async function saveBookingAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const id = pickString(formData, '_id');
  const resourceId = pickString(formData, 'resourceId');
  const customerId = pickString(formData, 'customerId');
  const slotStart = pickDateTime(formData, 'slotStart');
  const slotEnd = pickDateTime(formData, 'slotEnd');

  if (!resourceId) return { error: 'Resource is required.' };
  if (!customerId) return { error: 'Customer is required.' };
  if (!slotStart) return { error: 'Slot start is required.' };
  if (!slotEnd) return { error: 'Slot end is required.' };
  if (new Date(slotEnd).getTime() <= new Date(slotStart).getTime()) {
    return { error: 'Slot end must be after slot start.' };
  }

  const draft: CrmBookingCreateInput = {
    resourceId,
    customerId,
    service: pickString(formData, 'service'),
    slotStart,
    slotEnd,
    recurringRule: pickString(formData, 'recurringRule'),
    capacityUsed: pickNumber(formData, 'capacityUsed'),
    paymentStatus: pickPaymentStatus(formData),
    cancellationPolicy: pickString(formData, 'cancellationPolicy'),
    notes: pickString(formData, 'notes'),
  };

  try {
    let result: CrmBookingDoc;
    if (id) {
      // PATCH — lifecycle status is handled by dedicated endpoints,
      // so it's intentionally excluded from the update payload.
      const patch: CrmBookingUpdateInput = { ...draft };
      result = await crmBookingsApi.update(id, patch);
    } else {
      // POST — `status` is server-managed and defaults to `pending` on
      // the Rust side, so we don't forward the form value on create
      // either. (Caller can transition via /check-in or /cancel after.)
      // We still read it from the form so the field renders consistently.
      void pickStatus(formData);
      result = await crmBookingsApi.create(draft);
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Booking updated.' : 'Booking created.',
      id: String(result._id),
    };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete a booking. The Rust handler removes the row from the
 * collection — no soft-delete flag.
 */
export async function deleteBookingAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing booking id.' };
  try {
    await crmBookingsApi.delete(id);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Booking not found.' };
    }
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Programmatic helpers (typed) ────────────────────────────── */
//
// 'use server' files only allow async exports — these helpers thinly
// wrap the Rust client so callers don't have to remember `await
// crmBookingsApi.x(...)`.

export async function createBooking(input: CrmBookingCreateInput) {
  return crmBookingsApi.create(input);
}

export async function updateBooking(id: string, patch: CrmBookingUpdateInput) {
  return crmBookingsApi.update(id, patch);
}

export async function deleteBooking(id: string) {
  return crmBookingsApi.delete(id);
}
