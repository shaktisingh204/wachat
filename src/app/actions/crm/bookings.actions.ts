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

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { connectToDatabase } from '@/lib/mongodb';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { requirePermission } from '@/lib/rbac-server';
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

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

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
  const session = await getSession();
  if (!session?.user) return { bookings: [], page, limit, hasMore: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_booking', 'view');
  if (!guard.ok) return { bookings: [], page, limit, hasMore: false, error: guard.error };
  try {
    const bookings = await crmBookingsApi.list({ ...params, page, limit });
    return { bookings, page, limit, hasMore: bookings.length === limit };
  } catch (e) {
    console.error('[listBookings] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'booking', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { bookings: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getBooking(
  id: string,
): Promise<{ booking: CrmBookingDoc | null; error?: string }> {
  if (!id) return { booking: null, error: 'Missing booking id.' };
  const session = await getSession();
  if (!session?.user) return { booking: null, error: 'Unauthorized' };
  const guard = await requirePermission('crm_booking', 'view');
  if (!guard.ok) return { booking: null, error: guard.error };
  try {
    const booking = await crmBookingsApi.getById(id);
    return { booking };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { booking: null, error: 'Booking not found.' };
    }
    console.error('[getBooking] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'booking', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
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
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };

  const id = pickString(formData, '_id');
  const guard = await requirePermission('crm_booking', id ? 'edit' : 'create');
  if (!guard.ok) return { error: guard.error };

  // Touch the flag so the helper is referenced; the Rust path is the
  // only implementation here, but USE_RUST_CRM gating keeps parity with
  // the rest of the dual-impl actions.
  void useRustCrm();

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

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: id ? 'update' : 'create',
        entityKind: 'booking',
        entityId: String(result._id),
      });
    } catch {
      /* non-fatal */
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Booking updated.' : 'Booking created.',
      id: String(result._id),
    };
  } catch (e) {
    console.error('[saveBookingAction] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'booking', op: id ? 'update' : 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
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

  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };

  const guard = await requirePermission('crm_booking', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    await crmBookingsApi.delete(id);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'booking',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Booking not found.' };
    }
    console.error('[deleteBookingAction] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'booking', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
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

/* ─── Lifecycle (Mongo-direct, no Rust endpoint yet) ──────────── */

// TODO 1.P3: rust route missing — Rust crm-bookings doesn't expose
// /check-in /check-out /cancel /reschedule endpoints yet. These flow
// through the Mongo path until those routes ship.

/**
 * Persist a status transition directly to Mongo. The Rust client does
 * not expose dedicated /check-in /check-out /cancel /reschedule routes
 * yet, so we update the document in-place and emit an audit row.
 */
async function transitionBookingStatus(
  bookingId: string,
  nextStatus: CrmBookingStatus,
  patch: Record<string, unknown> = {},
  auditReason?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { success: false, error: 'Unauthorized' };
  }
  if (!ObjectId.isValid(bookingId)) {
    return { success: false, error: 'Invalid booking ID.' };
  }
  const guard = await requirePermission('crm_booking', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    const { db } = await connectToDatabase();
    const res = await db.collection('crm_bookings').updateOne(
      {
        _id: new ObjectId(bookingId),
        userId: new ObjectId(session.user._id as string),
      },
      {
        $set: {
          status: nextStatus,
          ...patch,
          updatedAt: new Date(),
        },
      } as any,
    );
    if (res.matchedCount === 0) {
      return { success: false, error: 'Booking not found.' };
    }
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'status_change',
        entityKind: 'booking',
        entityId: bookingId,
        reason: auditReason,
        diff: { status: { after: nextStatus } },
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${bookingId}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: rustErr(e) };
  }
}

export async function checkInBooking(bookingId: string) {
  return transitionBookingStatus(
    bookingId,
    'confirmed',
    { checkedInAt: new Date() },
    'checked in',
  );
}

export async function checkOutBooking(bookingId: string) {
  return transitionBookingStatus(
    bookingId,
    'completed',
    { checkedOutAt: new Date() },
    'checked out',
  );
}

export async function cancelBooking(bookingId: string, reason: string) {
  return transitionBookingStatus(
    bookingId,
    'cancelled',
    { cancelledAt: new Date(), cancelReason: reason || '' },
    reason || 'cancelled',
  );
}

export async function rescheduleBooking(
  bookingId: string,
  newSlot: { slotStart: string; slotEnd: string },
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { success: false, error: 'Unauthorized' };
  }
  if (!ObjectId.isValid(bookingId)) {
    return { success: false, error: 'Invalid booking ID.' };
  }
  const guard = await requirePermission('crm_booking', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };

  const start = new Date(newSlot.slotStart);
  const end = new Date(newSlot.slotEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { success: false, error: 'Invalid slot.' };
  }
  if (end.getTime() <= start.getTime()) {
    return { success: false, error: 'Slot end must be after slot start.' };
  }

  try {
    const { db } = await connectToDatabase();
    const res = await db.collection('crm_bookings').updateOne(
      {
        _id: new ObjectId(bookingId),
        userId: new ObjectId(session.user._id as string),
      },
      {
        $set: {
          slotStart: start,
          slotEnd: end,
          rescheduledAt: new Date(),
          updatedAt: new Date(),
        },
      } as any,
    );
    if (res.matchedCount === 0) {
      return { success: false, error: 'Booking not found.' };
    }
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'update',
        entityKind: 'booking',
        entityId: bookingId,
        reason: 'rescheduled',
        diff: {
          slotStart: { after: start.toISOString() },
          slotEnd: { after: end.toISOString() },
        },
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${bookingId}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: rustErr(e) };
  }
}

/* ─── KPIs ──────────────────────────────────────────────────────── */

export interface BookingKpis {
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  today: number;
}

/**
 * Aggregate booking counts for the KPI strip on the list page.
 * Falls back to zero-values on any error — the page still renders.
 */
export async function getBookingKpis(): Promise<BookingKpis> {
  const empty: BookingKpis = {
    total: 0,
    confirmed: 0,
    pending: 0,
    cancelled: 0,
    today: 0,
  };

  const session = await getSession();
  if (!session?.user?._id) return empty;

  const guard = await requirePermission('crm_booking', 'view');
  if (!guard.ok) return empty;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id as string);
    const coll = db.collection('crm_bookings');

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const [total, confirmed, pending, cancelled, today] = await Promise.all([
      coll.countDocuments({ userId }),
      coll.countDocuments({ userId, status: 'confirmed' }),
      coll.countDocuments({ userId, status: 'pending' }),
      coll.countDocuments({ userId, status: 'cancelled' }),
      coll.countDocuments({
        userId,
        slotStart: { $gte: todayStart, $lt: todayEnd },
      }),
    ]);

    return { total, confirmed, pending, cancelled, today };
  } catch (e) {
    console.error('[getBookingKpis] failed:', e);
    return empty;
  }
}
