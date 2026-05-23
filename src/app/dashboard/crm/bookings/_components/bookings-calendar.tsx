'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, dateFnsLocalizer, Event as RBCEvent } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import './react-big-calendar-overrides.css';

import type {
  CrmBookingDoc,
  CrmBookingStatus,
} from '@/lib/rust-client/crm-bookings';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface BookingsCalendarProps {
  bookings: CrmBookingDoc[];
}

interface BookingEvent extends RBCEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status?: CrmBookingStatus;
  resource: CrmBookingDoc;
}

function statusColor(status?: CrmBookingStatus) {
  switch (status) {
    case 'confirmed':
    case 'completed':
      return 'var(--zoru-success)';
    case 'cancelled':
    case 'no_show':
      return 'var(--zoru-danger)';
    case 'pending':
      return '#f59e0b'; // amber-500
    default:
      return 'var(--zoru-ink-muted)';
  }
}

export function BookingsCalendar({ bookings }: BookingsCalendarProps) {
  const router = useRouter();

  const events: BookingEvent[] = React.useMemo(() => {
    return bookings
      .filter((b) => b.slotStart && b.slotEnd)
      .map((b) => ({
        id: String(b._id),
        title: b.service || 'Booking',
        start: new Date(b.slotStart),
        end: new Date(b.slotEnd),
        status: b.status,
        resource: b,
      }));
  }, [bookings]);

  const handleSelectEvent = (event: BookingEvent) => {
    router.push(`/dashboard/crm/bookings/${event.id}`);
  };

  const eventStyleGetter = (event: BookingEvent) => {
    const backgroundColor = statusColor(event.status);
    return {
      style: {
        backgroundColor,
        borderRadius: 'var(--zoru-radius)',
        opacity: 0.9,
        color: '#fff',
        border: '0px',
        display: 'block',
        fontSize: '11px',
      },
    };
  };

  return (
    <div className="h-[600px] rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={eventStyleGetter}
        views={['month', 'week', 'day']}
        defaultView="month"
      />
    </div>
  );
}
