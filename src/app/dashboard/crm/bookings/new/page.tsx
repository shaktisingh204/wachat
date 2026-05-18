/**
 * Create booking — `/dashboard/crm/bookings/new`.
 *
 * Server component. Bookings have no custom-field plumbing
 * (`'booking'` isn't in `WsCustomFieldBelongsTo`), so the page just
 * renders the shared `<BookingForm>` (also used by Edit).
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { BookingForm } from '../_components/booking-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/bookings';

export default function NewBookingPage() {
  return (
    <EntityDetailShell
      eyebrow="BOOKING"
      title="New booking"
      back={{ href: BASE, label: 'Bookings' }}
    >
      <BookingForm />
    </EntityDetailShell>
  );
}
