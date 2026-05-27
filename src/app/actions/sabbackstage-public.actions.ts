'use server';

/**
 * SabBackstage PUBLIC server actions — driven by the unauthenticated
 * `/event/[pageSlug]/*` routes. Every action here intentionally skips
 * the session check; tenant binding is established by the Rust
 * `sabbackstage-public-pages` resolver and propagates to orders via
 * the host `crm_events` row.
 *
 * Flow:
 *   1. `loadPublicEventPage(slug)`               → renders /event/[slug]
 *   2. `createPublicTicketOrder({...})`          → pending order + redirect
 *   3. `confirmPublicTicketOrder(id, paymentRef)` → flips paid + issues tickets
 */

import { randomBytes } from 'node:crypto';

import {
  sabbackstagePublicPagesApi,
  type SabbackstagePublicPageView,
} from '@/lib/rust-client/sabbackstage-public-pages';
import {
  sabbackstageTicketTypesApi,
  type SabbackstageTicketTypeDoc,
} from '@/lib/rust-client/sabbackstage-ticket-types';
import {
  sabbackstageSponsorsApi,
  type SabbackstageSponsorDoc,
} from '@/lib/rust-client/sabbackstage-sponsors';
import {
  sabbackstageOrdersApi,
  type SabbackstageOrderDoc,
  type SabbackstagePublicCreateOrderInput,
} from '@/lib/rust-client/sabbackstage-orders';
import {
  sabbackstageTicketsApi,
  type SabbackstageTicketDoc,
} from '@/lib/rust-client/sabbackstage-tickets';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function err(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export interface PublicEventPageBundle {
  page: SabbackstagePublicPageView;
  ticketTypes: SabbackstageTicketTypeDoc[];
  sponsors: SabbackstageSponsorDoc[];
}

/**
 * Load everything `/event/[slug]/page.tsx` needs in one round trip:
 * the page chrome, live ticket types, and sponsors.
 */
export async function loadPublicEventPage(
  slug: string,
): Promise<Result<PublicEventPageBundle>> {
  try {
    const page = await sabbackstagePublicPagesApi.publicGetBySlug(slug);
    const [ticketTypes, sponsors] = await Promise.all([
      sabbackstageTicketTypesApi.publicListByEvent(page.eventId),
      sabbackstageSponsorsApi.publicListByEvent(page.eventId),
    ]);
    return { ok: true, data: { page, ticketTypes, sponsors } };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

export async function loadPublicSponsors(
  slug: string,
): Promise<Result<{ eventId: string; sponsors: SabbackstageSponsorDoc[] }>> {
  try {
    const page = await sabbackstagePublicPagesApi.publicGetBySlug(slug);
    const sponsors = await sabbackstageSponsorsApi.publicListByEvent(
      page.eventId,
    );
    return { ok: true, data: { eventId: page.eventId, sponsors } };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

/**
 * Create a pending public ticket order. The Rust handler resolves the
 * tenant via the host `crm_events` row and snapshots prices from
 * `sabbackstage_ticket_types`.
 */
export async function createPublicTicketOrder(
  args: SabbackstagePublicCreateOrderInput,
): Promise<Result<{ orderId: string; order: SabbackstageOrderDoc }>> {
  try {
    const created = await sabbackstageOrdersApi.publicCreate(args);
    return {
      ok: true,
      data: { orderId: created.id, order: created.entity },
    };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

function generateQrCode(): string {
  return randomBytes(18).toString('base64url');
}

/**
 * Confirm a public order:
 *   1. Flip the Rust order → `paid` with `paymentRef`.
 *   2. Issue one ticket row per seat (qty) across all items, using the
 *      buyer name/email as the default attendee identity. The buyer can
 *      later rename attendees from the `/event/[slug]/tickets/[orderId]`
 *      page (TODO: rename endpoint).
 *
 * Called from the SabCheckout gateway return route, or from the
 * mock success page when running against the default `MockGateway`.
 */
export async function confirmPublicTicketOrder(
  orderId: string,
  paymentRef: string,
): Promise<
  Result<{
    order: SabbackstageOrderDoc;
    tickets: SabbackstageTicketDoc[];
  }>
> {
  try {
    const order = await sabbackstageOrdersApi.publicConfirm(orderId, paymentRef);
    // Idempotency — if tickets already exist, skip issuance
    const existing = await sabbackstageTicketsApi.publicListByOrder(orderId);
    if (existing.length > 0) {
      return { ok: true, data: { order, tickets: existing } };
    }

    const issued: SabbackstageTicketDoc[] = [];
    for (const item of order.items) {
      for (let i = 0; i < item.qty; i++) {
        // The public-create flow has no session, so we cannot call the
        // admin issue endpoint here. We rely on the Rust admin handler
        // being safe to invoke by the orchestrator. For now, issue
        // via the admin handler is wired separately (TODO).
        const ticket = await sabbackstageTicketsApi.issue({
          typeId: item.typeId,
          eventId: order.eventId,
          orderId,
          attendeeName: order.buyerName,
          attendeeEmail: order.buyerEmail,
          attendeePhone: order.buyerPhone,
          qrCode: generateQrCode(),
        });
        issued.push(ticket.entity);
      }
    }
    return { ok: true, data: { order, tickets: issued } };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

/**
 * Public — load all tickets for an order. Powers the printable
 * ticket page at `/event/[slug]/tickets/[orderId]`.
 */
export async function loadPublicOrderTickets(
  orderId: string,
): Promise<
  Result<{ order: SabbackstageOrderDoc; tickets: SabbackstageTicketDoc[] }>
> {
  try {
    const [order, tickets] = await Promise.all([
      sabbackstageOrdersApi.publicGetById(orderId),
      sabbackstageTicketsApi.publicListByOrder(orderId),
    ]);
    return { ok: true, data: { order, tickets } };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

export async function loadPublicOrderSummary(
  orderId: string,
): Promise<Result<SabbackstageOrderDoc>> {
  try {
    const order = await sabbackstageOrdersApi.publicGetById(orderId);
    return { ok: true, data: order };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}
