'use client';

import { ZoruButton, useZoruToast } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import {
  Activity,
  CheckCircle2,
  LogIn,
  LogOut,
  Mail,
  Pencil,
  Printer,
  RefreshCcw,
  XCircle,
  } from 'lucide-react';

/**
 * <BookingDetailActions> — top-right action group on the booking detail
 * page. 8 actions per §1D.2: Edit · Check in · Check out · Cancel ·
 * Reschedule · Send confirmation · Print receipt · Activity.
 */

import * as React from 'react';
import Link from 'next/link';

import {
  checkInBooking,
  checkOutBooking,
} from '@/app/actions/crm/bookings.actions';

import {
  BookingCancelDialog,
  BookingRescheduleDialog,
  BookingSendConfirmationDialog,
} from './booking-detail-dialogs';

interface BookingDetailActionsProps {
  bookingId: string;
  status?: string;
  contactEmail?: string | null;
  slotStart?: string;
  slotEnd?: string;
}

export function BookingDetailActions({
  bookingId,
  status,
  contactEmail,
  slotStart,
  slotEnd,
}: BookingDetailActionsProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [, startTransition] = React.useTransition();

  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const runCheckIn = () => {
    startTransition(async () => {
      const res = await checkInBooking(bookingId);
      if (res.success) {
        toast({ title: 'Checked in' });
        router.refresh();
      } else {
        toast({
          title: 'Check-in failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  const runCheckOut = () => {
    startTransition(async () => {
      const res = await checkOutBooking(bookingId);
      if (res.success) {
        toast({ title: 'Checked out' });
        router.refresh();
      } else {
        toast({
          title: 'Check-out failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  const canCheckIn = status !== 'cancelled' && status !== 'completed';
  const canCheckOut = status === 'confirmed';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ZoruButton size="sm" variant="outline" asChild>
        <Link href={`/dashboard/crm/bookings/${bookingId}/edit`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      </ZoruButton>

      <ZoruButton
        size="sm"
        variant="outline"
        onClick={runCheckIn}
        disabled={!canCheckIn}
      >
        <LogIn className="h-3.5 w-3.5" /> Check in
      </ZoruButton>

      <ZoruButton
        size="sm"
        variant="outline"
        onClick={runCheckOut}
        disabled={!canCheckOut}
      >
        <LogOut className="h-3.5 w-3.5" /> Check out
      </ZoruButton>

      <ZoruButton
        size="sm"
        variant="outline"
        onClick={() => setCancelOpen(true)}
      >
        <XCircle className="h-3.5 w-3.5" /> Cancel
      </ZoruButton>

      <ZoruButton
        size="sm"
        variant="outline"
        onClick={() => setRescheduleOpen(true)}
      >
        <RefreshCcw className="h-3.5 w-3.5" /> Reschedule
      </ZoruButton>

      <ZoruButton
        size="sm"
        variant="outline"
        onClick={() => setConfirmOpen(true)}
      >
        <Mail className="h-3.5 w-3.5" /> Send confirmation
      </ZoruButton>

      <ZoruButton size="sm" variant="outline" onClick={() => window.print()}>
        <Printer className="h-3.5 w-3.5" /> Print receipt
      </ZoruButton>

      <ZoruButton size="sm" variant="ghost" asChild>
        <Link href={`/dashboard/crm/bookings/${bookingId}/activity`}>
          <Activity className="h-3.5 w-3.5" /> Activity
        </Link>
      </ZoruButton>

      <ZoruButton size="sm" variant="ghost" disabled aria-hidden="true">
        <CheckCircle2 className="hidden h-0 w-0" />
      </ZoruButton>

      <BookingCancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        bookingId={bookingId}
      />
      <BookingRescheduleDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        bookingId={bookingId}
        initialStart={slotStart}
        initialEnd={slotEnd}
      />
      <BookingSendConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        bookingId={bookingId}
        initialEmail={contactEmail ?? ''}
      />
    </div>
  );
}
