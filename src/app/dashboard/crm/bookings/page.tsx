import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { CalendarClock } from 'lucide-react';

export default function BookingsPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Bookings & Appointments"
        subtitle="Let customers book time on staff calendars and manage appointments."
        icon={CalendarClock}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          Bookings and appointments are coming soon. You will be able to publish booking
          pages, sync staff calendars and automate reminders, rescheduling and follow-ups.
        </p>
      </ZoruCard>
    </div>
  );
}
