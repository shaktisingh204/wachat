/**
 * Booking detail — `/dashboard/crm/bookings/[id]`.
 *
 * Server component: hydrates the booking via the Rust client and
 * resolves the customer / resource / service references through
 * `<EntityPickerChip>`. Edit and Delete actions live on this page; the
 * delete dialog itself is on the list page.
 *
 * NOTE: There is no custom-fields panel — `'booking'` is intentionally
 * not part of `WsCustomFieldBelongsTo`.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarClock, Pencil, ArrowLeft } from 'lucide-react';

import { ZoruButton, ZoruCard, ZoruBadge } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getBooking } from '@/app/actions/crm/bookings.actions';
import type { CrmBookingStatus } from '@/lib/rust-client/crm-bookings';

export const dynamic = 'force-dynamic';

function fmtDateTime(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function computeDuration(start?: string, end?: string): string {
  if (!start || !end) return '—';
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '—';
  const diffMs = e.getTime() - s.getTime();
  if (diffMs <= 0) return '—';
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function statusBadgeVariant(
  status?: CrmBookingStatus,
): 'success' | 'warning' | 'danger' | 'ghost' | 'outline' {
  switch (status) {
    case 'confirmed':
    case 'completed':
      return 'success';
    case 'cancelled':
    case 'no_show':
      return 'danger';
    case 'pending':
      return 'warning';
    default:
      return 'outline';
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
  const subtitle = `${fmtDateTime(booking.slotStart)}${
    booking.slotEnd ? ' → ' + fmtDateTime(booking.slotEnd) : ''
  }`;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={title}
        subtitle={subtitle}
        icon={CalendarClock}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/bookings">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`/dashboard/crm/bookings/${id}/edit`}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </ZoruButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <ZoruCard className="p-6 lg:col-span-2">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Parties
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Customer">
              {booking.customerId ? (
                <EntityPickerChip entity="client" id={booking.customerId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Assigned staff / resource">
              {booking.resourceId ? (
                <EntityPickerChip entity="user" id={booking.resourceId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Service">
              {booking.service ? (
                <EntityPickerChip entity="item" id={booking.service} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Capacity used">{booking.capacityUsed ?? 1}</Field>
          </div>

          <h3 className="mb-4 mt-8 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Scheduling
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Slot start">{fmtDateTime(booking.slotStart)}</Field>
            <Field label="Slot end">{fmtDateTime(booking.slotEnd)}</Field>
            <Field label="Duration">
              {computeDuration(booking.slotStart, booking.slotEnd)}
            </Field>
            <Field label="Recurring rule">{booking.recurringRule || '—'}</Field>
            <Field label="Cancellation policy">
              {booking.cancellationPolicy || '—'}
            </Field>
          </div>
        </ZoruCard>

        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Status
          </h3>
          <div className="flex flex-col gap-4">
            <Field label="Booking status">
              <ZoruBadge variant={statusBadgeVariant(booking.status)}>
                {booking.status ?? 'pending'}
              </ZoruBadge>
            </Field>
            <Field label="Payment status">
              {booking.paymentStatus ?? 'unpaid'}
            </Field>
            <Field label="No show">{booking.noShow ? 'Yes' : 'No'}</Field>
          </div>
        </ZoruCard>
      </div>

      {booking.notes ? (
        <ZoruCard className="p-6">
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Notes
          </h3>
          <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
            {booking.notes}
          </p>
        </ZoruCard>
      ) : null}

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(booking.createdAt)} · Updated{' '}
        {fmtDate(booking.updatedAt)}
      </div>
    </div>
  );
}
