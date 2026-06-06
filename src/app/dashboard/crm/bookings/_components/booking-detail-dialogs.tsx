'use client';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useRouter } from 'next/navigation';

/**
 * Booking detail-page dialogs:
 *   • <BookingCancelDialog> — captures a reason, calls cancelBooking.
 *   • <BookingRescheduleDialog> — picks a new slot, calls rescheduleBooking.
 *   • <BookingSendConfirmationDialog> — sends a wa.me / mailto link with
 *     pre-filled booking details. No server endpoint yet — fallback to
 *     the user's mail client until a transactional email endpoint exists.
 */

import * as React from 'react';

import {
  cancelBooking,
  rescheduleBooking,
} from '@/app/actions/crm/bookings.actions';

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
}

export function BookingCancelDialog({
  open,
  onOpenChange,
  bookingId,
}: BaseDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [reason, setReason] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const onSubmit = () => {
    startTransition(async () => {
      const res = await cancelBooking(bookingId, reason);
      if (res.success) {
        toast({ title: 'Cancelled' });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          title: 'Cancel failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this booking?</DialogTitle>
          <DialogDescription>
            Sets status to <strong>cancelled</strong> and records the reason
            in the audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="cancel-reason">Reason</Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1.5"
              placeholder="e.g. Customer rescheduled to next month"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button
            variant="destructive"
            onClick={onSubmit}
            disabled={pending}
          >
            {pending ? 'Cancelling…' : 'Cancel booking'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BookingRescheduleDialogProps extends BaseDialogProps {
  initialStart?: string;
  initialEnd?: string;
}

function toLocalDateTimeInput(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  // <input type="datetime-local"> wants `YYYY-MM-DDTHH:mm`.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BookingRescheduleDialog({
  open,
  onOpenChange,
  bookingId,
  initialStart,
  initialEnd,
}: BookingRescheduleDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [start, setStart] = React.useState('');
  const [end, setEnd] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setStart(toLocalDateTimeInput(initialStart));
      setEnd(toLocalDateTimeInput(initialEnd));
    }
  }, [open, initialStart, initialEnd]);

  const onSubmit = () => {
    if (!start || !end) {
      toast({
        title: 'Slot required',
        description: 'Pick both a start and an end time.',
        variant: 'destructive',
      });
      return;
    }
    startTransition(async () => {
      const res = await rescheduleBooking(bookingId, {
        slotStart: new Date(start).toISOString(),
        slotEnd: new Date(end).toISOString(),
      });
      if (res.success) {
        toast({ title: 'Rescheduled' });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          title: 'Reschedule failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule booking</DialogTitle>
          <DialogDescription>
            Pick the new slot — the original is overwritten and the change is
            audit-logged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="resched-start">New start</Label>
            <Input
              id="resched-start"
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="resched-end">New end</Label>
            <Input
              id="resched-end"
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? 'Saving…' : 'Reschedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BookingSendConfirmationDialogProps extends BaseDialogProps {
  initialEmail?: string;
}

export function BookingSendConfirmationDialog({
  open,
  onOpenChange,
  bookingId,
  initialEmail,
}: BookingSendConfirmationDialogProps) {
  const { toast } = useToast();
  const [to, setTo] = React.useState(initialEmail ?? '');
  const [message, setMessage] = React.useState(
    `Your booking is confirmed. Reference ID: ${bookingId}.`,
  );

  React.useEffect(() => {
    if (open) {
      setTo(initialEmail ?? '');
    }
  }, [open, initialEmail]);

  const onSubmit = () => {
    if (!to) {
      toast({
        title: 'Recipient required',
        description: 'Enter an email or phone to send the confirmation.',
        variant: 'destructive',
      });
      return;
    }
    const subject = `Booking confirmation #${bookingId.slice(-6)}`;
    const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    window.open(href, '_blank', 'noopener,noreferrer');
    onOpenChange(false);
    /* TODO 1D.2: transactional booking-confirmation email needs server-side endpoint */
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send confirmation</DialogTitle>
          <DialogDescription>
            Opens your mail client with the confirmation pre-filled.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="bcd-to">Recipient email</Label>
            <Input
              id="bcd-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1.5"
              placeholder="customer@example.com"
            />
          </div>
          <div>
            <Label htmlFor="bcd-msg">Message</Label>
            <Textarea
              id="bcd-msg"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit}>Open mail client</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
