'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { AlertCircle } from 'lucide-react';

export default function ActivityError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <EntityDetailShell
      title="Error Loading Activity"
      eyebrow="ITEM ACTIVITY"
    >
      <div className="flex h-[400px] flex-col items-center justify-center space-y-4 rounded-xl border border-dashed p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2/10">
          <AlertCircle className="h-6 w-6 text-zoru-ink" />
        </div>
        <div className="space-y-1 text-center">
          <h3 className="text-lg font-medium">Something went wrong!</h3>
          <p className="text-sm text-zoru-ink-muted">
            {error.message || "We couldn't load the item activity at this time."}
          </p>
        </div>
        <Button onClick={() => reset()} variant="outline">
          Try again
        </Button>
      </div>
    </EntityDetailShell>
  );
}
