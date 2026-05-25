'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button, EmptyState } from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function FilesError({
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
    <EntityListShell title="Files">
      <EmptyState
        icon={AlertCircle}
        title="Failed to load files"
        description="An error occurred while loading the files."
        action={<Button onClick={() => reset()}>Try again</Button>}
      />
    </EntityListShell>
  );
}
