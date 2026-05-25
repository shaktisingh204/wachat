'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button, EmptyState } from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function NewDealError({
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
    <EntityListShell title="New Deal">
      <EmptyState
        icon={AlertCircle}
        title="Redirect Failed"
        description="An error occurred while redirecting to the new deal form."
        action={<Button onClick={() => reset()}>Try again</Button>}
      />
    </EntityListShell>
  );
}
