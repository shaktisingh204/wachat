'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function FileFoldersError({
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
    <EntityListShell title="Files & Folders">
      <EmptyState
        icon={AlertCircle}
        title="Failed to load folders"
        description="An error occurred while loading the file tree."
        action={<Button onClick={() => reset()}>Try again</Button>}
      />
    </EntityListShell>
  );
}
