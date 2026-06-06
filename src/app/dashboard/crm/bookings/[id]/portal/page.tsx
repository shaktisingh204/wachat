import * as React from 'react';
import { notFound } from 'next/navigation';
import { getBooking } from '@/app/actions/crm/bookings.actions';
import { Card, CardBody, CardHeader, CardTitle, Badge } from '@/components/sabcrm/20ui/compat';
import { PortalActions, ClientDate } from './portal-client';
export const dynamic = 'force-dynamic';

export default async function BookingPortalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { booking, error } = await getBooking(id);

  if (!booking) {
    if (error) {
      throw new Error(error);
    }
    notFound();
  }

  const isPast = new Date(booking.slotStart).getTime() < Date.now();
  const canModify = !isPast && booking.status !== 'cancelled' && booking.status !== 'completed';

  const getStatusTone = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return 'green';
      case 'completed': return 'blue';
      case 'cancelled': return 'red';
      case 'pending': return 'amber';
      default: return 'neutral';
    }
  };

  return (
    <div className="w-full p-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-[var(--st-text)]">Manage Your Booking</h1>
        <p className="text-[var(--st-text-secondary)]">Reference: {String(booking._id).slice(-8)}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{booking.service || 'Appointment Details'}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4 text-sm text-[var(--st-text)]">
          <div className="flex items-center justify-between border-b border-[var(--st-border)] pb-3">
            <span className="text-[var(--st-text-secondary)]">Status</span>
            <Badge tone={getStatusTone(booking.status)} className="capitalize">
              {booking.status || 'pending'}
            </Badge>
          </div>
          <div className="flex items-center justify-between border-b border-[var(--st-border)] pb-3 pt-1">
            <span className="text-[var(--st-text-secondary)]">Date & Time</span>
            <span className="font-medium"><ClientDate dateString={String(booking.slotStart)} /></span>
          </div>
          
          {canModify ? (
            <PortalActions 
              bookingId={id} 
              currentStart={String(booking.slotStart)} 
              currentEnd={String(booking.slotEnd)} 
            />
          ) : (
            <div className="rounded-md bg-[var(--st-bg-muted)] p-3 text-center text-[var(--st-text-secondary)]">
              This booking cannot be modified at this time.
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
