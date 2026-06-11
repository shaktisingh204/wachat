'use server';

/**
 * SabBigin booking pages — public scheduling (a major Bigin feature).
 *
 * Tenant-managed booking pages live in `sabbigin_booking_pages` (mirrors the
 * `sabbigin-bookings` Rust crate); confirmed bookings land in
 * `sabbigin_bookings`. The public `/book/[slug]` route reads the page and
 * generates slots with the unauthed helpers here; a booking upserts a contact,
 * logs a Meeting activity, and dispatches `entity_created` automations.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { generateBookingDays } from '@/lib/sabbigin/booking-logic';

const PAGES = 'sabbigin_booking_pages';
const BOOKINGS = 'sabbigin_bookings';

export interface AvailabilityWindow {
  dow: number; // 0=Sun .. 6=Sat
  start: string; // "09:00"
  end: string; // "17:00"
}

export interface BookingQuestion {
  key: string;
  label: string;
  required: boolean;
}

export interface SabbiginBookingPageDoc {
  _id: string;
  userId: string;
  slug: string;
  title: string;
  description?: string | null;
  durationMin: number;
  timezone: string;
  weeklyAvailability: AvailabilityWindow[];
  bufferMin: number;
  dateRangeDays: number;
  questions: BookingQuestion[];
  pipelineId?: string | null;
  confirmationMessage?: string | null;
  status: 'active' | 'archived';
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface SabbiginBookingDoc {
  _id: string;
  pageId: string;
  startAt: string;
  endAt: string;
  name: string;
  email: string;
  phone?: string | null;
  answers?: Record<string, string>;
  status: 'confirmed' | 'cancelled';
  createdAt?: string | null;
}

/* ─── Tenant management (session-scoped) ──────────────────────────── */

export async function listSabbiginBookingPages(): Promise<SabbiginBookingPageDoc[]> {
  const session = await getSession();
  if (!session?.user?._id) return [];
  try {
    const { db } = await connectToDatabase();
    const rows = await db
      .collection(PAGES)
      .find({ userId: new ObjectId(session.user._id), status: { $ne: 'archived' } })
      .sort({ createdAt: -1 })
      .toArray();
    return JSON.parse(JSON.stringify(rows)) as SabbiginBookingPageDoc[];
  } catch (e) {
    console.error('[listSabbiginBookingPages] failed:', e);
    return [];
  }
}

export async function getSabbiginBookingPage(
  id: string,
): Promise<SabbiginBookingPageDoc | null> {
  const session = await getSession();
  if (!session?.user?._id || !ObjectId.isValid(id)) return null;
  try {
    const { db } = await connectToDatabase();
    const doc = await db
      .collection(PAGES)
      .findOne({ _id: new ObjectId(id), userId: new ObjectId(session.user._id) });
    return doc ? (JSON.parse(JSON.stringify(doc)) as SabbiginBookingPageDoc) : null;
  } catch {
    return null;
  }
}

export interface SaveBookingPageInput {
  id?: string;
  slug: string;
  title: string;
  description?: string;
  durationMin: number;
  timezone: string;
  weeklyAvailability: AvailabilityWindow[];
  bufferMin: number;
  dateRangeDays: number;
  questions: BookingQuestion[];
  pipelineId?: string;
  confirmationMessage?: string;
}

export async function saveSabbiginBookingPage(
  input: SaveBookingPageInput,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied' };
  const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!slug) return { success: false, error: 'A URL slug is required' };
  if (!input.title.trim()) return { success: false, error: 'A title is required' };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);

    // slug uniqueness (per all tenants, since public URLs are global)
    const clash = await db
      .collection(PAGES)
      .findOne({ slug, ...(input.id ? { _id: { $ne: new ObjectId(input.id) } } : {}) });
    if (clash) return { success: false, error: 'That URL is taken — pick another slug.' };

    const doc = {
      userId,
      slug,
      title: input.title.trim(),
      description: input.description ?? null,
      durationMin: Math.max(5, input.durationMin || 30),
      timezone: input.timezone || 'Asia/Kolkata',
      weeklyAvailability: input.weeklyAvailability ?? [],
      bufferMin: Math.max(0, input.bufferMin || 0),
      dateRangeDays: Math.max(1, input.dateRangeDays || 30),
      questions: input.questions ?? [],
      pipelineId: input.pipelineId ?? null,
      confirmationMessage: input.confirmationMessage ?? null,
      status: 'active' as const,
      updatedAt: new Date(),
    };

    if (input.id && ObjectId.isValid(input.id)) {
      await db
        .collection(PAGES)
        .updateOne({ _id: new ObjectId(input.id), userId }, { $set: doc });
      revalidatePath('/dashboard/sabbigin/settings/booking');
      return { success: true, id: input.id };
    }
    const r = await db
      .collection(PAGES)
      .insertOne({ ...doc, createdAt: new Date() });
    revalidatePath('/dashboard/sabbigin/settings/booking');
    return { success: true, id: r.insertedId.toHexString() };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to save booking page' };
  }
}

export async function deleteSabbiginBookingPage(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id || !ObjectId.isValid(id))
    return { success: false, error: 'Invalid request' };
  try {
    const { db } = await connectToDatabase();
    await db
      .collection(PAGES)
      .updateOne(
        { _id: new ObjectId(id), userId: new ObjectId(session.user._id) },
        { $set: { status: 'archived', updatedAt: new Date() } },
      );
    revalidatePath('/dashboard/sabbigin/settings/booking');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed' };
  }
}

export async function listSabbiginBookings(
  pageId?: string,
): Promise<SabbiginBookingDoc[]> {
  const session = await getSession();
  if (!session?.user?._id) return [];
  try {
    const { db } = await connectToDatabase();
    // restrict to the tenant's own pages
    const myPages = await db
      .collection(PAGES)
      .find({ userId: new ObjectId(session.user._id) })
      .project({ _id: 1 })
      .toArray();
    const ids = myPages.map((p) => String(p._id));
    const filter: Record<string, unknown> = { pageId: { $in: ids } };
    if (pageId) filter.pageId = pageId;
    const rows = await db
      .collection(BOOKINGS)
      .find(filter)
      .sort({ startAt: 1 })
      .limit(500)
      .toArray();
    return JSON.parse(JSON.stringify(rows)) as SabbiginBookingDoc[];
  } catch {
    return [];
  }
}

/* ─── Public (UNauthed) — used by /book/[slug] ────────────────────── */

export async function getPublicBookingPage(
  slug: string,
): Promise<SabbiginBookingPageDoc | null> {
  if (!slug) return null;
  try {
    const { db } = await connectToDatabase();
    const doc = await db
      .collection(PAGES)
      .findOne({ slug: slug.toLowerCase(), status: { $ne: 'archived' } });
    return doc ? (JSON.parse(JSON.stringify(doc)) as SabbiginBookingPageDoc) : null;
  } catch {
    return null;
  }
}

export type BookingSlot = { startISO: string; label: string };
export type BookingDay = { dateISO: string; label: string; slots: BookingSlot[] };

/**
 * Generate available slots for the next `dateRangeDays`, subtracting already
 * booked slots. Slot math lives in the pure, tested `generateBookingDays`.
 */
export async function getPublicBookingSlots(
  slug: string,
): Promise<{ page: SabbiginBookingPageDoc | null; days: BookingDay[] }> {
  const page = await getPublicBookingPage(slug);
  if (!page) return { page: null, days: [] };

  let taken = new Set<string>();
  try {
    const { db } = await connectToDatabase();
    const existing = await db
      .collection(BOOKINGS)
      .find({ pageId: page._id, status: 'confirmed' })
      .project({ startAt: 1 })
      .toArray();
    taken = new Set(existing.map((b) => new Date(b.startAt as string).toISOString()));
  } catch {
    /* fall through with empty set */
  }

  const days = generateBookingDays(page, new Date(), taken);
  return { page, days };
}

export async function createPublicBooking(input: {
  slug: string;
  startISO: string;
  name: string;
  email: string;
  phone?: string;
  answers?: Record<string, string>;
}): Promise<{ success: boolean; error?: string }> {
  if (!input.name?.trim() || !input.email?.trim())
    return { success: false, error: 'Name and email are required' };
  try {
    const { db } = await connectToDatabase();
    const page = await db
      .collection(PAGES)
      .findOne({ slug: input.slug.toLowerCase(), status: { $ne: 'archived' } });
    if (!page) return { success: false, error: 'Booking page not found' };

    const start = new Date(input.startISO);
    if (Number.isNaN(start.getTime()))
      return { success: false, error: 'Invalid time slot' };
    const end = new Date(start.getTime() + (page.durationMin as number) * 60000);

    // double-book guard
    const clash = await db.collection(BOOKINGS).findOne({
      pageId: String(page._id),
      startAt: start.toISOString(),
      status: 'confirmed',
    });
    if (clash) return { success: false, error: 'That slot was just taken — pick another.' };

    const ownerId = page.userId as ObjectId;

    // upsert contact by email within the page owner's book
    const email = input.email.trim().toLowerCase();
    let contact = await db
      .collection('crm_contacts')
      .findOne({ userId: ownerId, email });
    if (!contact) {
      const ins = await db.collection('crm_contacts').insertOne({
        userId: ownerId,
        name: input.name.trim(),
        email,
        phone: input.phone ?? '',
        source: 'Booking page',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      contact = { _id: ins.insertedId } as any;
    }

    await db.collection(BOOKINGS).insertOne({
      pageId: String(page._id),
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      name: input.name.trim(),
      email,
      phone: input.phone ?? null,
      answers: input.answers ?? {},
      contactId: String(contact!._id),
      status: 'confirmed',
      createdAt: new Date(),
    });

    // log a Meeting activity
    const activity = await db.collection('crm_activities').insertOne({
      userId: ownerId,
      type: 'meeting',
      typeLabel: 'Meeting',
      subject: `${page.title} with ${input.name.trim()}`,
      title: `${page.title} with ${input.name.trim()}`,
      status: 'open',
      dueDate: start,
      contactId: String(contact!._id),
      notes: `Booked via ${page.title}`,
      createdAt: new Date(),
    });

    // dispatch automations (best-effort)
    try {
      const { dispatchAutomations } = await import('@/lib/automations/dispatch');
      await dispatchAutomations({
        type: 'entity_created',
        entityKind: 'task',
        entityId: String(activity.insertedId),
        tenantUserId: String(ownerId),
        entity: { type: 'meeting', contactId: String(contact!._id) } as any,
        occurredAt: Date.now(),
      });
    } catch {
      /* best-effort */
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to book' };
  }
}
