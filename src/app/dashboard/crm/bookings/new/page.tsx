/**
 * Create booking — `/dashboard/crm/bookings/new`.
 *
 * Server component. Bookings have no custom-field plumbing
 * (`'booking'` isn't in `WsCustomFieldBelongsTo`), so the page just
 * renders the shared `<BookingForm>` (also used by Edit).
 */

import { CalendarClock } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';
import { BookingForm } from '../_components/booking-form';

export const dynamic = 'force-dynamic';

export default function NewBookingPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New booking"
        subtitle="Reserve a slot for a customer."
        icon={CalendarClock}
      />
      <BookingForm />
    </div>
  );
}
