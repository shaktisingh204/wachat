'use client';

import { useEffect } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Card, Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Shift Rotation Detail Error:', error);
  }, [error]);

  return (
    <EntityListShell
      title="Error Loading Rotation"
      subtitle="There was a problem fetching the shift rotation details."
    >
      <Card className="p-8 text-center flex flex-col items-center gap-4">
        <AlertCircle className="h-10 w-10 text-zoru-danger-ink" />
        <h2 className="text-[16px] text-zoru-ink">Failed to load data</h2>
        <p className="text-[13px] text-zoru-ink-muted">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <Button onClick={() => reset()} variant="outline">
          Try again
        </Button>
      </Card>
    </EntityListShell>
  );
}
