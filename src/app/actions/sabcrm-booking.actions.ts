'use server';

/**
 * SabCRM — Calendly-class booking-link server actions.
 *
 * Two distinct surfaces:
 *
 *   1. CONFIG actions (`listBookingLinksTw` / `saveBookingLinkTw` /
 *      `deleteBookingLinkTw` / `getBookingAvailabilityTw`) — GATED. The
 *      `gate` / `fail` helpers are copied verbatim from
 *      `sabcrm-scoring.actions.ts` (session → project membership → RBAC
 *      `canServer('sabcrm', …)` → plan), including the cross-tenant defense
 *      against a client-supplied `projectId`. Reads gate `view`; writes gate
 *      `edit`.
 *
 *   2. PUBLIC actions (`getPublicBookingLink` / `getPublicAvailability` /
 *      `createBookingPublic`) — UNGATED but validated, like
 *      `sabcrm-forms-public.actions.ts`. Invoked from the public booking page
 *      (`/sabcrm/book/[slug]`) which has no session. Tenant resolution is
 *      entirely server-side: the link document carries its own `projectId` +
 *      `ownerUserId`, so the caller can never choose a tenant. Defenses:
 *      honeypot, naive per-instance rate limit, server-side slot + email
 *      re-validation, and a per-owner `api_calls` usage meter so a hostile
 *      client can't run up unbounded bookings.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import { canUse } from '@/lib/billing/entitlements';
import { recordUsage } from '@/lib/billing/usage-meter';
import {
  listBookingLinks,
  getBookingLink,
  getBookingLinkBySlug,
  upsertBookingLink,
  deleteBookingLink,
  getAvailability,
  createBooking,
  toPublicLink,
  type BookingLink,
  type BookingLinkInput,
  type PublicBookingLink,
  type AvailabilityResult,
  type BookingContact,
  type BookingConfirmation,
  type DateRange,
} from '@/lib/sabcrm/booking.server';

const MODULE_KEY = 'sabcrm';

interface SessionUser {
  _id: string;
}

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult = { ok: true; ctx: GateContext } | { ok: false; error: string };

/** session → project membership → RBAC → plan (mirrors sabcrm-scoring.actions.ts). */
async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }

  if (!(await canServer(MODULE_KEY, action, requested))) {
    return { ok: false, error: 'Permission denied.' };
  }
  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }
  return { ok: true, ctx: { userId, projectId: requested } };
}

function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) return { ok: false, error: e.message || fallback };
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

/* -------------------------------------------------------------------------- */
/* GATED config actions                                                        */
/* -------------------------------------------------------------------------- */

/** List every booking link in the active project. Gated on `view`. */
export async function listBookingLinksTw(
  projectId?: string,
): Promise<ActionResult<BookingLink[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await listBookingLinks(g.ctx.projectId) };
  } catch (e) {
    return fail(e, 'Failed to load booking links.');
  }
}

/** Fetch one booking link by id. Gated on `view`. */
export async function getBookingLinkTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<BookingLink>> {
  if (!id) return { ok: false, error: 'A link id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const link = await getBookingLink(g.ctx.projectId, id);
    if (!link) return { ok: false, error: 'Booking link not found.' };
    return { ok: true, data: link };
  } catch (e) {
    return fail(e, 'Failed to load booking link.');
  }
}

/**
 * Create or update a booking link. Gated on `edit`. The current session user
 * becomes the link's `ownerUserId` on insert (whose calendar busy times +
 * record ownership the link uses); the stored owner is preserved on update.
 */
export async function saveBookingLinkTw(
  input: BookingLinkInput,
  projectId?: string,
): Promise<ActionResult<BookingLink>> {
  if (!input?.name?.trim()) return { ok: false, error: 'A name is required.' };
  if (!input?.objectSlug?.trim()) {
    return { ok: false, error: 'An object to create is required.' };
  }
  if (!input?.tz?.trim()) return { ok: false, error: 'A timezone is required.' };
  if (!Number.isFinite(input.durationMins) || input.durationMins <= 0) {
    return { ok: false, error: 'A positive duration is required.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    // Preserve the original owner on update; otherwise the editor is the owner.
    let ownerUserId = g.ctx.userId;
    if (input.id) {
      const existing = await getBookingLink(g.ctx.projectId, input.id);
      if (existing?.ownerUserId) ownerUserId = existing.ownerUserId;
    }
    const saved = await upsertBookingLink(g.ctx.projectId, ownerUserId, input);
    return { ok: true, data: saved };
  } catch (e) {
    return fail(e, 'Failed to save booking link.');
  }
}

/** Delete a booking link by id. Gated on `edit`. */
export async function deleteBookingLinkTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'A link id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await deleteBookingLink(g.ctx.projectId, id);
    if (!ok) return { ok: false, error: 'Booking link not found.' };
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete booking link.');
  }
}

/**
 * Preview availability for a link (the in-app admin preview). Gated on `view`.
 * Public visitors use the UNGATED `getPublicAvailability` instead.
 */
export async function getBookingAvailabilityTw(
  slug: string,
  range?: Partial<DateRange>,
  projectId?: string,
): Promise<ActionResult<AvailabilityResult>> {
  if (!slug) return { ok: false, error: 'A slug is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    // Re-scope: only return availability for a link the project actually owns.
    const link = await getBookingLinkBySlug(slug);
    if (!link || link.projectId !== g.ctx.projectId) {
      return { ok: false, error: 'Booking link not found.' };
    }
    const res = await getAvailability(slug, range);
    if (!res) return { ok: false, error: 'Booking link not found.' };
    return { ok: true, data: res };
  } catch (e) {
    return fail(e, 'Failed to load availability.');
  }
}

/* -------------------------------------------------------------------------- */
/* PUBLIC (ungated, validated) actions                                         */
/* -------------------------------------------------------------------------- */

/** Naive in-process rate limiter — best-effort, per server instance. */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 12;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

export type PublicBookingResult =
  | { ok: true; data: BookingConfirmation }
  | { ok: false; error: string };

/**
 * Fetch the public (secret-free) view of a booking link by slug. UNGATED —
 * the slug carries its own tenant. Returns null-shaped error when the slug is
 * unknown / disabled.
 */
export async function getPublicBookingLink(
  slug: string,
): Promise<ActionResult<PublicBookingLink>> {
  if (!slug || typeof slug !== 'string') {
    return { ok: false, error: 'Invalid link.' };
  }
  try {
    const link = await getBookingLinkBySlug(slug);
    if (!link) return { ok: false, error: 'This booking link is not available.' };
    return { ok: true, data: toPublicLink(link) };
  } catch {
    return { ok: false, error: 'This booking link is not available.' };
  }
}

/**
 * Public availability for a slug + day range. UNGATED. Strips the link to the
 * public view; busy-time merge happens server-side against the OWNER's stored
 * calendar credentials (never exposed).
 */
export async function getPublicAvailability(
  slug: string,
  range?: Partial<DateRange>,
): Promise<ActionResult<AvailabilityResult>> {
  if (!slug || typeof slug !== 'string') {
    return { ok: false, error: 'Invalid link.' };
  }
  try {
    const res = await getAvailability(slug, range);
    if (!res) return { ok: false, error: 'This booking link is not available.' };
    return { ok: true, data: res };
  } catch {
    return { ok: false, error: 'Could not load availability.' };
  }
}

/**
 * Create a booking from the PUBLIC page. UNGATED but heavily validated:
 *   - honeypot (`_hp`) silently accepted;
 *   - naive per-slug rate limit;
 *   - slot + email re-validation inside `createBooking` (server-authoritative);
 *   - per-owner `api_calls` usage meter (blocks abuse, records consumption).
 *
 * Tenant is resolved entirely from the stored link — the caller supplies only
 * the slug, time and contact.
 */
export async function createBookingPublic(
  slug: string,
  slotIso: string,
  contact: BookingContact & { _hp?: string },
): Promise<PublicBookingResult> {
  if (!slug || typeof slug !== 'string') {
    return { ok: false, error: 'Invalid link.' };
  }
  if (!slotIso || typeof slotIso !== 'string') {
    return { ok: false, error: 'Please pick a time.' };
  }

  // Honeypot: bots tend to fill hidden fields. Silently "accept" without work.
  if (typeof contact?._hp === 'string' && contact._hp.trim() !== '') {
    return {
      ok: false,
      error: 'Submission received.',
    };
  }

  if (rateLimited(slug.trim())) {
    return { ok: false, error: 'Too many requests. Please try again shortly.' };
  }

  try {
    const link = await getBookingLinkBySlug(slug);
    if (!link) return { ok: false, error: 'This booking link is not available.' };

    // Meter against the owning user (tenant) — block if over quota, else record.
    const allowed = await canUse(link.ownerUserId, 'api_calls').catch(() => true);
    if (!allowed) {
      return {
        ok: false,
        error: 'This booking link is temporarily unavailable. Please try later.',
      };
    }

    const confirmation = await createBooking(slug, slotIso, {
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      note: contact.note,
    });

    // Best-effort usage record — never block a successful booking on metering.
    void recordUsage({
      tenantId: link.ownerUserId,
      feature: 'api_calls',
      units: 1,
      meta: { source: 'sabcrm-booking', slug: link.slug, recordId: confirmation.recordId },
      idempotencyKey: `booking:${link.slug}:${confirmation.recordId}`,
    }).catch(() => undefined);

    return { ok: true, data: confirmation };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not complete booking.' };
  }
}
