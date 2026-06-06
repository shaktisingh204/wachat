'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button, EmptyState } from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function BookingsError({
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
    <EntityListShell title="Bookings">
      <EmptyState
        icon={AlertCircle}
        title="Failed to load bookings"
        description="An error occurred while loading the bookings data."
        action={<Button onClick={() => reset()}>Try again</Button>}
      />
    </EntityListShell>
  );
}
