import { ZoruBadge, ZoruButton, ZoruCard, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

/**
 * Booking detail — `/dashboard/crm/bookings/[id]`.
 *
 * Server component per §1D.2. Uses `<EntityDetailShell>` with:
 *   - Header: 8 actions (Edit · Check in · Check out · Cancel ·
 *     Reschedule · Send confirmation · Print receipt · Activity).
 *   - Body cards: Overview · Resource · Customer · Payment · Notes.
 *   - Right rail: Status · Resource chip · Customer chip · Slot card ·
 *     Related entities (recurring bookings, payments).
 *   - Audit footer via EntityDetailShell `audit` prop.
 */

import Link from 'next/link';

import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getBooking } from '@/app/actions/crm/bookings.actions';
import type { CrmBookingStatus } from '@/lib/rust-client/crm-bookings';

import { BookingDetailActions } from '../_components/booking-detail-actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

export const dynamic = 'force-dynamic';

function fmtDateTime(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function computeDuration(start?: string, end?: string): string {
  if (!start || !end) return '—';
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '—';
  const diffMs = e.getTime() - s.getTime();
  if (diffMs <= 0) return '—';
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function statusTone(status?: CrmBookingStatus): EntityStatusTone {
  switch (status) {
    case 'confirmed':
    case 'completed':
      return 'green';
    case 'cancelled':
    case 'no_show':
      return 'red';
    case 'pending':
      return 'amber';
    default:
      return 'neutral';
  }
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
    </div>
  );
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { booking, error } = await getBooking(id);

  if (!booking) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this booking — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/bookings">
              <ArrowLeft className="h-4 w-4" /> Back to Bookings
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const title = booking.service || `Booking ${String(booking._id).slice(-6)}`;
  const status = booking.status ?? 'pending';

  return (
    <EntityDetailShell
      title={title}
      eyebrow="BOOKING"
      status={{ label: status, tone: statusTone(status) }}
      back={{ href: '/dashboard/crm/bookings', label: 'Back to Bookings' }}
      actions={
        <BookingDetailActions
          bookingId={id}
          status={status}
          slotStart={booking.slotStart}
          slotEnd={booking.slotEnd}
        />
      }
      audit={<EntityAuditTimeline entityKind="booking" entityId={id} />}
      rightRail={
        <>
          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Status</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">Booking</span>
                  <ZoruBadge variant="outline">{status}</ZoruBadge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">Payment</span>
                  <ZoruBadge variant="outline">
                    {booking.paymentStatus ?? 'unpaid'}
                  </ZoruBadge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">No-show</span>
                  <span className="text-zoru-ink">
                    {booking.noShow ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </ZoruCardContent>
          </ZoruCard>

          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Resource</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              {booking.resourceId ? (
                <EntityPickerChip entity="user" id={booking.resourceId} />
              ) : (
                <span className="text-[12.5px] text-zoru-ink-muted">
                  No resource
                </span>
              )}
            </ZoruCardContent>
          </ZoruCard>

          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Customer</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              {booking.customerId ? (
                <EntityPickerChip entity="client" id={booking.customerId} />
              ) : (
                <span className="text-[12.5px] text-zoru-ink-muted">
                  No customer
                </span>
              )}
            </ZoruCardContent>
          </ZoruCard>

          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Slot</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-1.5 text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-zoru-ink-muted">Start</span>
                  <span>{fmtDateTime(booking.slotStart)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zoru-ink-muted">End</span>
                  <span>{fmtDateTime(booking.slotEnd)}</span>
                </div>
                <div className="flex justify-between border-t border-zoru-line pt-1.5">
                  <span className="text-zoru-ink-muted">Duration</span>
                  <span>
                    {computeDuration(booking.slotStart, booking.slotEnd)}
                  </span>
                </div>
              </div>
            </ZoruCardContent>
          </ZoruCard>

          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Related</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="flex flex-col gap-2 text-[12.5px]">
                {booking.recurringRule ? (
                  <Link
                    href={`/dashboard/crm/bookings?recurringFrom=${id}`}
                    className="text-zoru-primary hover:underline"
                  >
                    Recurring series →
                  </Link>
                ) : (
                  <span className="text-zoru-ink-muted">
                    No recurring series
                  </span>
                )}
                <Link
                  href={`/dashboard/crm/sales/receipts?bookingId=${id}`}
                  className="text-zoru-primary hover:underline"
                >
                  Payments →
                </Link>
              </div>
            </ZoruCardContent>
          </ZoruCard>
        </>
      }
    >
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Overview</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Service">{booking.service || '—'}</Field>
            <Field label="Capacity used">{booking.capacityUsed ?? 1}</Field>
            <Field label="Slot start">{fmtDateTime(booking.slotStart)}</Field>
            <Field label="Slot end">{fmtDateTime(booking.slotEnd)}</Field>
            <Field label="Duration">
              {computeDuration(booking.slotStart, booking.slotEnd)}
            </Field>
            <Field label="Recurring rule">
              {booking.recurringRule || '—'}
            </Field>
            <Field label="Cancellation policy">
              {booking.cancellationPolicy || '—'}
            </Field>
          </div>
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Resource &amp; customer</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Customer">
              {booking.customerId ? (
                <EntityPickerChip entity="client" id={booking.customerId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Resource / staff">
              {booking.resourceId ? (
                <EntityPickerChip entity="user" id={booking.resourceId} />
              ) : (
                '—'
              )}
            </Field>
          </div>
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Payment</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Payment status">
              <ZoruBadge variant="outline">
                {booking.paymentStatus ?? 'unpaid'}
              </ZoruBadge>
            </Field>
            <Field label="No-show">{booking.noShow ? 'Yes' : 'No'}</Field>
          </div>
        </ZoruCardContent>
      </ZoruCard>

      {booking.notes ? (
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>Notes</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
              {booking.notes}
            </p>
          </ZoruCardContent>
        </ZoruCard>
      ) : null}

      <p className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(booking.createdAt)} · Updated{' '}
        {fmtDate(booking.updatedAt)}
      </p>
    </EntityDetailShell>
  );
}
