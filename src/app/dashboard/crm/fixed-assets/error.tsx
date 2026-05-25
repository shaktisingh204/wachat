'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button, EmptyState } from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function FixedAssetsError({
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
    <EntityListShell title="Fixed Assets">
      <EmptyState
        icon={AlertCircle}
        title="Failed to load fixed assets"
        description="An error occurred while loading the fixed assets."
        action={<Button onClick={() => reset()}>Try again</Button>}
      />
    </EntityListShell>
  );
}
