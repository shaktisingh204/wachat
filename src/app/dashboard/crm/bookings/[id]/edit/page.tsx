/**
 * Edit booking — `/dashboard/crm/bookings/[id]/edit`.
 *
 * Hydrates the existing booking and passes it to the shared
 * `<BookingForm>` (re-used from the Create flow). The form submits a
 * PATCH because `_id` is rendered as a hidden input.
 */

import { notFound } from 'next/navigation';
import { CalendarClock } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { BookingForm } from '../../_components/booking-form';
import { getBooking } from '@/app/actions/crm/bookings.actions';

export const dynamic = 'force-dynamic';

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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Edit ${title}`}
        subtitle="Update booking details."
        icon={CalendarClock}
      />
      <BookingForm initial={booking} />
    </div>
  );
}
