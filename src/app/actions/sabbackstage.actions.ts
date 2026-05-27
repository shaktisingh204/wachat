'use server';

/**
 * SabBackstage admin server actions.
 *
 * Wraps the five Rust crates under `/v1/sabbackstage/*` for the admin
 * UI (Ticketing / Sponsors / Public-page / Check-in tabs on the event
 * detail page). Every action here REQUIRES a logged-in session — the
 * UNAUTHENTICATED public surface (slug lookup, public order creation,
 * confirmation) lives in `sabbackstage-public.actions.ts`.
 *
 * The Rust BFF is the source of truth — no Mongo fallback here.
 */

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';

import { getSession } from '@/app/actions/user.actions';
import {
  sabbackstageTicketTypesApi,
  type SabbackstageTicketTypeCreateInput,
  type SabbackstageTicketTypeDoc,
  type SabbackstageTicketTypeListParams,
  type SabbackstageTicketTypeListResponse,
  type SabbackstageTicketTypeUpdateInput,
} from '@/lib/rust-client/sabbackstage-ticket-types';
import {
  sabbackstageTicketsApi,
  type SabbackstageCheckInResponse,
  type SabbackstageTicketDoc,
  type SabbackstageTicketIssueInput,
  type SabbackstageTicketListParams,
  type SabbackstageTicketListResponse,
  type SabbackstageTicketUpdateInput,
} from '@/lib/rust-client/sabbackstage-tickets';
import {
  sabbackstageOrdersApi,
  type SabbackstageOrderDoc,
  type SabbackstageOrderListParams,
  type SabbackstageOrderListResponse,
  type SabbackstageOrderUpdateInput,
} from '@/lib/rust-client/sabbackstage-orders';
import {
  sabbackstageSponsorsApi,
  type SabbackstageSponsorCreateInput,
  type SabbackstageSponsorDoc,
  type SabbackstageSponsorListParams,
  type SabbackstageSponsorListResponse,
  type SabbackstageSponsorUpdateInput,
} from '@/lib/rust-client/sabbackstage-sponsors';
import {
  sabbackstagePublicPagesApi,
  type SabbackstagePublicPageCreateInput,
  type SabbackstagePublicPageDoc,
  type SabbackstagePublicPageListParams,
  type SabbackstagePublicPageListResponse,
  type SabbackstagePublicPageUpdateInput,
} from '@/lib/rust-client/sabbackstage-public-pages';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function err(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function revalidateEvent(eventId: string): void {
  revalidatePath(`/dashboard/crm/workspace/events/${eventId}`);
}

async function requireSession(): Promise<void> {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized — no active session');
  }
}

/* ─── Ticket Types ─────────────────────────────────────────────── */

export async function listSabbackstageTicketTypes(
  params?: SabbackstageTicketTypeListParams,
): Promise<Result<SabbackstageTicketTypeListResponse>> {
  try {
    await requireSession();
    const data = await sabbackstageTicketTypesApi.list(params);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

export async function createSabbackstageTicketType(
  input: SabbackstageTicketTypeCreateInput,
): Promise<Result<SabbackstageTicketTypeDoc>> {
  try {
    await requireSession();
    const data = await sabbackstageTicketTypesApi.create(input);
    revalidateEvent(input.eventId);
    return { ok: true, data: data.entity };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

export async function updateSabbackstageTicketType(
  id: string,
  patch: SabbackstageTicketTypeUpdateInput,
  eventIdForRevalidate?: string,
): Promise<Result<SabbackstageTicketTypeDoc>> {
  try {
    await requireSession();
    const data = await sabbackstageTicketTypesApi.update(id, patch);
    if (eventIdForRevalidate) revalidateEvent(eventIdForRevalidate);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

export async function deleteSabbackstageTicketType(
  id: string,
  eventIdForRevalidate?: string,
): Promise<Result<{ deleted: boolean }>> {
  try {
    await requireSession();
    const data = await sabbackstageTicketTypesApi.delete(id);
    if (eventIdForRevalidate) revalidateEvent(eventIdForRevalidate);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

/* ─── Tickets ──────────────────────────────────────────────────── */

export async function listSabbackstageTickets(
  params?: SabbackstageTicketListParams,
): Promise<Result<SabbackstageTicketListResponse>> {
  try {
    await requireSession();
    const data = await sabbackstageTicketsApi.list(params);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

/**
 * Generate a stable, opaque QR payload for a seat. Encoded as a URL-
 * safe base64 of 18 random bytes (24 chars). Stored verbatim on the
 * ticket row; the public ticket page renders it as the QR payload.
 */
function generateQrCode(): string {
  return randomBytes(18).toString('base64url');
}

/**
 * Issue a single ticket. Used by the public-order confirmation flow
 * and by admin "manually issue" UIs. The Rust handler requires
 * `qrCode` to be pre-computed for retry safety.
 */
export async function issueSabbackstageTicket(
  input: Omit<SabbackstageTicketIssueInput, 'qrCode'> & { qrCode?: string },
): Promise<Result<SabbackstageTicketDoc>> {
  try {
    await requireSession();
    const qrCode = input.qrCode || generateQrCode();
    const data = await sabbackstageTicketsApi.issue({ ...input, qrCode });
    revalidateEvent(input.eventId);
    return { ok: true, data: data.entity };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

export async function updateSabbackstageTicket(
  id: string,
  patch: SabbackstageTicketUpdateInput,
  eventIdForRevalidate?: string,
): Promise<Result<SabbackstageTicketDoc>> {
  try {
    await requireSession();
    const data = await sabbackstageTicketsApi.update(id, patch);
    if (eventIdForRevalidate) revalidateEvent(eventIdForRevalidate);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

/**
 * Admin check-in by QR-scan / scanner-gun input. Idempotent —
 * scanning a checked-in ticket returns `alreadyCheckedIn: true`.
 */
export async function checkInSabbackstageTicket(
  qrCode: string,
  eventIdForRevalidate?: string,
): Promise<Result<SabbackstageCheckInResponse>> {
  try {
    await requireSession();
    const data = await sabbackstageTicketsApi.checkIn(qrCode);
    if (eventIdForRevalidate) revalidateEvent(eventIdForRevalidate);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

/* ─── Orders ───────────────────────────────────────────────────── */

export async function listSabbackstageOrders(
  params?: SabbackstageOrderListParams,
): Promise<Result<SabbackstageOrderListResponse>> {
  try {
    await requireSession();
    const data = await sabbackstageOrdersApi.list(params);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

export async function getSabbackstageOrder(
  id: string,
): Promise<Result<SabbackstageOrderDoc>> {
  try {
    await requireSession();
    const data = await sabbackstageOrdersApi.getById(id);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

export async function updateSabbackstageOrder(
  id: string,
  patch: SabbackstageOrderUpdateInput,
  eventIdForRevalidate?: string,
): Promise<Result<SabbackstageOrderDoc>> {
  try {
    await requireSession();
    const data = await sabbackstageOrdersApi.update(id, patch);
    if (eventIdForRevalidate) revalidateEvent(eventIdForRevalidate);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

/**
 * Refund an order. Status-only — actual gateway refund is delegated
 * to the configured `ICheckoutGateway` (TODO: wire when SabCheckout's
 * gateway exposes a `refundPayment` hook). Marks the order
 * `refunded`; all issued tickets on that order are also cancelled.
 */
export async function refundSabbackstageOrder(
  orderId: string,
): Promise<Result<SabbackstageOrderDoc>> {
  try {
    await requireSession();
    // 1) flip the order
    const order = await sabbackstageOrdersApi.update(orderId, {
      status: 'refunded',
    });
    // 2) cancel all issued tickets for the order
    const tix = await sabbackstageTicketsApi.list({
      orderId,
      status: 'issued',
      limit: 200,
    });
    for (const t of tix.items) {
      await sabbackstageTicketsApi.update(t._id, { status: 'cancelled' });
    }
    revalidateEvent(order.eventId);
    return { ok: true, data: order };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

/* ─── Sponsors ─────────────────────────────────────────────────── */

export async function listSabbackstageSponsors(
  params?: SabbackstageSponsorListParams,
): Promise<Result<SabbackstageSponsorListResponse>> {
  try {
    await requireSession();
    const data = await sabbackstageSponsorsApi.list(params);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

export async function createSabbackstageSponsor(
  input: SabbackstageSponsorCreateInput,
): Promise<Result<SabbackstageSponsorDoc>> {
  try {
    await requireSession();
    const data = await sabbackstageSponsorsApi.create(input);
    revalidateEvent(input.eventId);
    return { ok: true, data: data.entity };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

export async function updateSabbackstageSponsor(
  id: string,
  patch: SabbackstageSponsorUpdateInput,
  eventIdForRevalidate?: string,
): Promise<Result<SabbackstageSponsorDoc>> {
  try {
    await requireSession();
    const data = await sabbackstageSponsorsApi.update(id, patch);
    if (eventIdForRevalidate) revalidateEvent(eventIdForRevalidate);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

export async function deleteSabbackstageSponsor(
  id: string,
  eventIdForRevalidate?: string,
): Promise<Result<{ deleted: boolean }>> {
  try {
    await requireSession();
    const data = await sabbackstageSponsorsApi.delete(id);
    if (eventIdForRevalidate) revalidateEvent(eventIdForRevalidate);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

/* ─── Public Pages ─────────────────────────────────────────────── */

export async function listSabbackstagePublicPages(
  params?: SabbackstagePublicPageListParams,
): Promise<Result<SabbackstagePublicPageListResponse>> {
  try {
    await requireSession();
    const data = await sabbackstagePublicPagesApi.list(params);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

export async function createSabbackstagePublicPage(
  input: SabbackstagePublicPageCreateInput,
): Promise<Result<SabbackstagePublicPageDoc>> {
  try {
    await requireSession();
    const data = await sabbackstagePublicPagesApi.create(input);
    revalidateEvent(input.eventId);
    return { ok: true, data: data.entity };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

export async function updateSabbackstagePublicPage(
  id: string,
  patch: SabbackstagePublicPageUpdateInput,
  eventIdForRevalidate?: string,
): Promise<Result<SabbackstagePublicPageDoc>> {
  try {
    await requireSession();
    const data = await sabbackstagePublicPagesApi.update(id, patch);
    if (eventIdForRevalidate) revalidateEvent(eventIdForRevalidate);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

export async function deleteSabbackstagePublicPage(
  id: string,
  eventIdForRevalidate?: string,
): Promise<Result<{ deleted: boolean }>> {
  try {
    await requireSession();
    const data = await sabbackstagePublicPagesApi.delete(id);
    if (eventIdForRevalidate) revalidateEvent(eventIdForRevalidate);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}
