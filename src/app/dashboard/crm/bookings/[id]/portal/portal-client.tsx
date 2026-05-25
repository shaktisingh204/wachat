'use client';

import * as React from 'react';
import { Button, Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, Label, Textarea, DatePicker } from '@/components/zoruui';
import { useToast } from '@/components/zoruui/use-zoru-toast';
import { cancelBooking, rescheduleBooking } from '@/app/actions/crm/bookings.actions';
import { Loader2 } from 'lucide-react';

export function ClientDate({ dateString }: { dateString: string }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span className="opacity-0">Loading...</span>;
  }

  return <span>{new Date(dateString).toLocaleString()}</span>;
}

export function PortalActions({ 
  bookingId, 
  currentStart, 
  currentEnd 
}: { 
  bookingId: string; 
  currentStart: string; 
  currentEnd: string;
}) {
  const [isCancelOpen, setIsCancelOpen] = React.useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = React.useState(false);
  
  const [cancelReason, setCancelReason] = React.useState('');
  const [newDate, setNewDate] = React.useState<Date | undefined>(new Date(currentStart));
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const { toast } = useToast();

  const handleCancel = async () => {
    setIsSubmitting(true);
    const res = await cancelBooking(bookingId, cancelReason);
    setIsSubmitting(false);
    if (res.success) {
      toast({ title: 'Booking cancelled' });
      setIsCancelOpen(false);
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  const handleReschedule = async () => {
    if (!newDate) return;
    setIsSubmitting(true);
    
    // keep the same duration
    const origStart = new Date(currentStart);
    const origEnd = new Date(currentEnd);
    const durationMs = origEnd.getTime() - origStart.getTime();
    
    // Create new slot combining newDate with origStart time
    const slotStart = new Date(newDate);
    slotStart.setHours(origStart.getHours(), origStart.getMinutes(), 0, 0);
    
    const slotEnd = new Date(slotStart.getTime() + durationMs);

    const res = await rescheduleBooking(bookingId, { 
      slotStart: slotStart.toISOString(), 
      slotEnd: slotEnd.toISOString() 
    });
    setIsSubmitting(false);
    
    if (res.success) {
      toast({ title: 'Booking rescheduled' });
      setIsRescheduleOpen(false);
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  return (
    <>
      <div className="flex gap-4 pt-4">
        <Button variant="outline" className="w-full" onClick={() => setIsRescheduleOpen(true)}>Reschedule</Button>
        <Button variant="destructive" className="w-full" onClick={() => setIsCancelOpen(true)}>Cancel Booking</Button>
      </div>

      <Dialog open={isCancelOpen} onOpenChange={setIsCancelOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Cancel Booking</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Reason for cancellation (optional)</Label>
              <Textarea 
                value={cancelReason} 
                onChange={e => setCancelReason(e.target.value)} 
                placeholder="Why are you cancelling?"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCancelOpen(false)} disabled={isSubmitting}>Back</Button>
              <Button variant="destructive" onClick={handleCancel} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </ZoruDialogContent>
      </Dialog>

      <Dialog open={isRescheduleOpen} onOpenChange={setIsRescheduleOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Reschedule Booking</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Select new date</Label>
              <DatePicker value={newDate} onChange={setNewDate} />
              <p className="text-xs text-zoru-ink-muted mt-2">Time will remain the same as original booking.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsRescheduleOpen(false)} disabled={isSubmitting}>Back</Button>
              <Button onClick={handleReschedule} disabled={!newDate || isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Reschedule
              </Button>
            </div>
          </div>
        </ZoruDialogContent>
      </Dialog>
    </>
  );
}
