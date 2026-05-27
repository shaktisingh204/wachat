'use server';

/**
 * Workplace Events server actions.
 *
 * Rust-only: every read/write goes through the `crm-events` BFF
 * (`/v1/crm/events`) via `crmEventsApi`. There is no legacy Mongo
 * fallback for this entity — the Rust crate is the source of truth.
 * Errors are recorded via `recordRustFallback` for observability so
 * dashboards still show a signal when the BFF flakes.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import {
  crmEventsApi,
  type CrmEventCreateInput,
  type CrmEventDoc,
  type CrmEventStatus,
  type CrmEventType,
  type CrmEventUpdateInput,
  type CrmEventsListParams,
  type CrmEventsListResponse,
} from '@/lib/rust-client/crm-events';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { pushToCalendar } from '@/lib/integrations/google-calendar';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const DASHBOARD_PATH = '/dashboard/hrm/hr/events';

interface GetEventsFilters {
  q?: string;
  status?: CrmEventStatus | 'all';
  eventType?: CrmEventType | string;
  organizerId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

type SaveEventState = {
  message?: string;
  error?: string;
  id?: string;
};

function safeNumber(value: FormDataEntryValue | null): number | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function trimmedString(value: FormDataEntryValue | null): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s ? s : undefined;
}

function isChecked(value: FormDataEntryValue | null): boolean {
  if (value == null) return false;
  const s = String(value).toLowerCase();
  return s === 'on' || s === 'true' || s === '1' || s === 'yes';
}

function toIsoOrUndef(value: FormDataEntryValue | null): string | undefined {
  const s = trimmedString(value);
  if (!s) return undefined;
  // `datetime-local` returns `YYYY-MM-DDTHH:mm` — `new Date(...)` interprets
  // that as local-time, which is what users expect when picking dates in
  // the form. ISO it for the BFF.
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * List workplace events for the current user with the given filters.
 *
 * Always returns a list response; on BFF failure we record the fallback
 * and return an empty page so the UI degrades gracefully.
 */
export async function getEvents(
  filters: GetEventsFilters = {},
): Promise<CrmEventsListResponse> {
  const session = await getSession();
  if (!session?.user) {
    return { items: [], page: 1, limit: 0, hasMore: false };
  }

  const guard = await requirePermission('crm_event', 'view');
  if (!guard.ok) {
    return { items: [], page: 1, limit: 0, hasMore: false };
  }

  const params: CrmEventsListParams = {
    page: filters.page,
    limit: filters.limit,
    q: filters.q,
    status: filters.status,
    eventType: filters.eventType,
    organizerId: filters.organizerId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };

  try {
    const res = await crmEventsApi.list(params);
    return JSON.parse(JSON.stringify(res));
  } catch (e) {
    console.error('[getEvents] rust path failed:', e);
    recordRustFallback({
      entity: 'crm_event',
      op: 'list',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { items: [], page: 1, limit: filters.limit ?? 0, hasMore: false };
  }
}

/**
 * Fetch a single event by id, scoped to the current user by the BFF.
 */
export async function getEventById(id: string): Promise<CrmEventDoc | null> {
  const session = await getSession();
  if (!session?.user) return null;
  if (!id) return null;

  const guard = await requirePermission('crm_event', 'view');
  if (!guard.ok) return null;

  try {
    const doc = await crmEventsApi.getById(id);
    return JSON.parse(JSON.stringify(doc));
  } catch (e) {
    console.error('[getEventById] rust path failed:', e);
    recordRustFallback({
      entity: 'crm_event',
      op: 'get',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return null;
  }
}

/**
 * Create or update an event from a `FormData` payload.
 *
 * Hidden field `id` (or `eventId`) signals an update; absent means create.
 * Compatible with `useActionState`.
 */
export async function saveEvent(
  _prev: SaveEventState | undefined,
  formData: FormData,
): Promise<SaveEventState> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const id =
    trimmedString(formData.get('id')) ??
    trimmedString(formData.get('eventId'));
  const isEditing = Boolean(id);

  const guard = await requirePermission(
    'crm_event',
    isEditing ? 'edit' : 'create',
  );
  if (!guard.ok) return { error: guard.error };

  const name = trimmedString(formData.get('name'));
  if (!name) return { error: 'Event name is required.' };

  const startsAt = toIsoOrUndef(formData.get('starts_at'));
  if (!startsAt && !isEditing) {
    return { error: 'Start date/time is required.' };
  }

  const endsAt = toIsoOrUndef(formData.get('ends_at'));
  if (startsAt && endsAt) {
    const s = new Date(startsAt).getTime();
    const e = new Date(endsAt).getTime();
    if (Number.isFinite(s) && Number.isFinite(e) && e < s) {
      return { error: 'End date/time must be on or after the start.' };
    }
  }

  const isOnline = isChecked(formData.get('is_online'));
  const isRecurring = isChecked(formData.get('is_recurring'));

  const payload: CrmEventCreateInput = {
    name,
    description: trimmedString(formData.get('description')),
    eventType: trimmedString(formData.get('event_type')) ?? 'meeting',
    // `startsAt` is required on create; on edit the BFF accepts a partial
    // patch, so we only set it when present.
    startsAt: startsAt ?? '',
    endsAt,
    isAllDay: isChecked(formData.get('is_all_day')),
    location: trimmedString(formData.get('location')),
    isOnline,
    meetingUrl: isOnline ? trimmedString(formData.get('meeting_url')) : undefined,
    organizerName: trimmedString(formData.get('organizer_name')),
    maxAttendees: safeNumber(formData.get('max_attendees')),
    isRecurring,
    recurrenceRule: isRecurring
      ? trimmedString(formData.get('recurrence_rule'))
      : undefined,
    bannerUrl: trimmedString(formData.get('banner_url')),
    reminderMinutes: safeNumber(formData.get('reminder_minutes')),
  };

  const status = trimmedString(formData.get('status')) as
    | CrmEventStatus
    | undefined;

  try {
    if (isEditing && id) {
      const patch: CrmEventUpdateInput = {
        ...payload,
        // Omit startsAt from the patch when the user didn't change it.
        startsAt: startsAt ?? undefined,
        status,
      };
      await crmEventsApi.update(id, patch);
      revalidatePath(DASHBOARD_PATH);
      revalidatePath(`${DASHBOARD_PATH}/${id}`);
      return { message: 'Event updated.', id };
    }

    const res = await crmEventsApi.create({
      ...payload,
      startsAt: startsAt!,
    });
    revalidatePath(DASHBOARD_PATH);

    // Google Calendar — non-fatal; never breaks event creation. Stores
    // the resulting Google event id on a side-collection so a future
    // delete can call `removeFromCalendar`.
    try {
      const startIso = startsAt ?? new Date().toISOString();
      const endIso = endsAt ?? new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();
      const push = await pushToCalendar(String(session.user._id), {
        summary: name,
        description: payload.description ?? undefined,
        start: startIso,
        end: endIso,
        location: payload.location ?? undefined,
        allDay: payload.isAllDay,
      });
      if (res.id) {
        const { db } = await connectToDatabase();
        const eventOid = ObjectId.isValid(res.id) ? new ObjectId(res.id) : null;
        const filter = eventOid ? { _id: eventOid } : { rustEventId: res.id };
        await db.collection('crm_event_calendar_sync').updateOne(
          { ...filter, userId: new ObjectId(String(session.user._id)) },
          {
            $set: {
              userId: new ObjectId(String(session.user._id)),
              eventRef: res.id,
              googleEventId: push.googleEventId ?? null,
              syncFailed: !push.ok,
              syncError: push.ok ? null : push.error ?? null,
              updatedAt: new Date(),
            },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true },
        );
      }
    } catch (err) {
      console.warn('[saveEvent] google calendar push failed:', err);
    }

    return { message: 'Event created.', id: res.id };
  } catch (e) {
    console.error('[saveEvent] rust path failed:', e);
    recordRustFallback({
      entity: 'crm_event',
      op: isEditing ? 'update' : 'create',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    const msg =
      e instanceof RustApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Unknown error';
    return { error: `Failed to save event: ${msg}` };
  }
}

/**
 * Delete a workplace event by id.
 */
export async function deleteEvent(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  if (!id) return { success: false, error: 'Invalid event id.' };

  const guard = await requirePermission('crm_event', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    await crmEventsApi.delete(id);
    revalidatePath(DASHBOARD_PATH);
    return { success: true };
  } catch (e) {
    console.error('[deleteEvent] rust path failed:', e);
    recordRustFallback({
      entity: 'crm_event',
      op: 'delete',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    const msg =
      e instanceof RustApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Unknown error';
    return { success: false, error: `Failed to delete event: ${msg}` };
  }
}
