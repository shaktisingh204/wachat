'use client';

import { Button, EmptyState } from '@/components/sabcrm/20ui/compat';
import { AlertTriangle } from 'lucide-react';
import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function BookingEditError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();

  React.useEffect(() => {
    console.error('[CRM Booking Edit] route error', error);
  }, [error]);

  const id = params?.id as string | undefined;

  return (
    <div className="flex w-full flex-col items-center justify-center py-20 px-6">
      <EmptyState
        icon={<AlertTriangle />}
        title="Failed to Load Booking for Editing"
        description={
          error?.message?.length && error.message.length < 200
            ? error.message
            : 'An unexpected error occurred while loading the booking details. Please try again or return to the booking page.'
        }
        action={
          <div className="flex items-center gap-3">
            <Button size="md" onClick={() => reset()}>
              Try Again
            </Button>
            {id && (
              <Link href={`/dashboard/crm/bookings/${id}`}>
                <Button size="md" variant="outline">
                  Back to Booking
                </Button>
              </Link>
            )}
            <Link href="/dashboard/crm/bookings">
              <Button size="md" variant="ghost">
                Bookings List
              </Button>
            </Link>
          </div>
        }
      />
    </div>
  );
}
