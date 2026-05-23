import * as React from 'react';
import { notFound } from 'next/navigation';
import { getBooking } from '@/app/actions/crm/bookings.actions';
import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Button } from '@/components/zoruui';

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
      return <div className="p-8 text-center text-red-500">Error loading booking: {error}</div>;
    }
    notFound();
  }

  const isPast = new Date(booking.slotStart).getTime() < Date.now();
  const canModify = !isPast && booking.status !== 'cancelled' && booking.status !== 'completed';

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
          <div className="flex justify-between border-b border-zoru-line pb-2">
            <span className="text-zoru-ink-muted">Status</span>
            <span className="font-medium capitalize">{booking.status || 'pending'}</span>
          </div>
          <div className="flex justify-between border-b border-zoru-line pb-2">
            <span className="text-zoru-ink-muted">Date & Time</span>
            <span className="font-medium">{new Date(booking.slotStart).toLocaleString()}</span>
          </div>
          
          {canModify ? (
            <div className="flex gap-4 pt-4">
              <Button variant="outline" className="w-full">Reschedule</Button>
              <Button variant="destructive" className="w-full">Cancel Booking</Button>
            </div>
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
