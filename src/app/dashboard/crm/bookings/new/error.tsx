'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button, EmptyState } from '@/components/zoruui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function BookingNewError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EntityDetailShell
      eyebrow="BOOKING"
      title="New booking"
      back={{ href: '/dashboard/crm/bookings', label: 'Bookings' }}
    >
      <EmptyState
        icon={AlertCircle}
        title="Failed to load booking form"
        description="An error occurred while loading the booking form."
        action={<Button onClick={() => reset()}>Try again</Button>}
      />
    </EntityDetailShell>
  );
}
