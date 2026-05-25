import * as React from 'react';
import { notFound } from 'next/navigation';
import { getBooking } from '@/app/actions/crm/bookings.actions';
import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Badge } from '@/components/zoruui';
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
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-zoru-ink">Manage Your Booking</h1>
        <p className="text-zoru-ink-muted">Reference: {String(booking._id).slice(-8)}</p>
      </div>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>{booking.service || 'Appointment Details'}</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4 text-sm text-zoru-ink">
          <div className="flex items-center justify-between border-b border-zoru-line pb-3">
            <span className="text-zoru-ink-muted">Status</span>
            <Badge tone={getStatusTone(booking.status)} className="capitalize">
              {booking.status || 'pending'}
            </Badge>
          </div>
          <div className="flex items-center justify-between border-b border-zoru-line pb-3 pt-1">
            <span className="text-zoru-ink-muted">Date & Time</span>
            <span className="font-medium"><ClientDate dateString={String(booking.slotStart)} /></span>
          </div>
          
          {canModify ? (
            <PortalActions 
              bookingId={id} 
              currentStart={String(booking.slotStart)} 
              currentEnd={String(booking.slotEnd)} 
            />
          ) : (
            <div className="rounded-md bg-zoru-surface-2 p-3 text-center text-zoru-ink-muted">
              This booking cannot be modified at this time.
            </div>
          )}
        </ZoruCardContent>
      </Card>
    </div>
  );
}
