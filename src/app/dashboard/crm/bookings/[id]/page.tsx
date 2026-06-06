import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';

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
  const mins = Math.floor(diffMs / 60000);
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
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-[var(--st-text)]">{children}</div>
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
          <p className="text-[14px] text-[var(--st-text)]">
            Couldn&apos;t load this booking — {error}
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/crm/bookings">
              <ArrowLeft className="h-4 w-4" /> Back to Bookings
            </Link>
          </Button>
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
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--st-text-secondary)]">Booking</span>
                  <Badge variant="outline">{status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--st-text-secondary)]">Payment</span>
                  <Badge variant="outline">
                    {booking.paymentStatus ?? 'unpaid'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--st-text-secondary)]">No-show</span>
                  <span className="text-[var(--st-text)]">
                    {booking.noShow ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resource</CardTitle>
            </CardHeader>
            <CardBody>
              {booking.resourceId ? (
                <EntityPickerChip entity="user" id={booking.resourceId} fallback="Deleted resource" />
              ) : (
                <span className="text-[12.5px] text-[var(--st-text-secondary)]">
                  No resource
                </span>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardBody>
              {booking.customerId ? (
                <EntityPickerChip entity="client" id={booking.customerId} fallback="Deleted customer" />
              ) : (
                <span className="text-[12.5px] text-[var(--st-text-secondary)]">
                  No customer
                </span>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Slot</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-1.5 text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-[var(--st-text-secondary)]">Start</span>
                  <span>{fmtDateTime(booking.slotStart)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--st-text-secondary)]">End</span>
                  <span>{fmtDateTime(booking.slotEnd)}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--st-border)] pt-1.5">
                  <span className="text-[var(--st-text-secondary)]">Duration</span>
                  <span>
                    {computeDuration(booking.slotStart, booking.slotEnd)}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Related</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="flex flex-col gap-2 text-[12.5px]">
                <Link
                  href={`/dashboard/crm/bookings/${id}/portal`}
                  className="text-[var(--st-text)] hover:underline"
                >
                  Self-service portal →
                </Link>
                {booking.recurringRule ? (
                  <Link
                    href={`/dashboard/crm/bookings?recurringFrom=${id}`}
                    className="text-[var(--st-text)] hover:underline"
                  >
                    Recurring series →
                  </Link>
                ) : (
                  <span className="text-[var(--st-text-secondary)]">
                    No recurring series
                  </span>
                )}
                <Link
                  href={`/dashboard/crm/sales/receipts?bookingId=${id}`}
                  className="text-[var(--st-text)] hover:underline"
                >
                  Payments →
                </Link>
              </div>
            </CardBody>
          </Card>
        </>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardBody>
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
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resource &amp; customer</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Customer">
              {booking.customerId ? (
                <EntityPickerChip entity="client" id={booking.customerId} fallback="Deleted customer" />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Resource / staff">
              {booking.resourceId ? (
                <EntityPickerChip entity="user" id={booking.resourceId} fallback="Deleted resource" />
              ) : (
                '—'
              )}
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Payment status">
              <Badge variant="outline">
                {booking.paymentStatus ?? 'unpaid'}
              </Badge>
            </Field>
            <Field label="No-show">{booking.noShow ? 'Yes' : 'No'}</Field>
          </div>
        </CardBody>
      </Card>

      {booking.reminders && booking.reminders.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Reminders</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-2 text-[12.5px] text-[var(--st-text)]">
              {booking.reminders.map((r, i) => (
                <div key={i} className="flex items-center justify-between border-b border-[var(--st-border)] pb-1 last:border-0 last:pb-0">
                  <span>{new Date(r.at).toLocaleString()} via <span className="capitalize font-medium">{r.channel}</span></span>
                  <Badge variant={r.sent ? 'default' : 'outline'}>{r.sent ? 'Sent' : 'Scheduled'}</Badge>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Reminders</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-[12.5px] text-[var(--st-text-secondary)]">No automated reminders configured.</p>
          </CardBody>
        </Card>
      )}

      {booking.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
              {booking.notes}
            </p>
          </CardBody>
        </Card>
      ) : null}

      <p className="text-[11px] text-[var(--st-text-secondary)]">
        Created {fmtDate(booking.createdAt)} · Updated{' '}
        {fmtDate(booking.updatedAt)}
      </p>
    </EntityDetailShell>
  );
}
