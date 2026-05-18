/**
 * Edit booking — `/dashboard/crm/bookings/[id]/edit`.
 *
 * Hydrates the existing booking and passes it to the shared
 * `<BookingForm>` (re-used from the Create flow). The form submits a
 * PATCH because `_id` is rendered as a hidden input.
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { BookingForm } from '../../_components/booking-form';
import { getBooking } from '@/app/actions/crm/bookings.actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/bookings';

export default async function EditBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { booking } = await getBooking(id);

  if (!booking) notFound();

  const title =
    booking.service || `Booking ${String(booking._id).slice(-6)}`;

  return (
    <EntityDetailShell
      eyebrow="BOOKING"
      title={`Edit · ${title}`}
      back={{ href: BASE, label: 'Bookings' }}
    >
      <BookingForm initial={booking} />
    </EntityDetailShell>
  );
}
