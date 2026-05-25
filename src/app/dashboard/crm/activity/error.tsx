'use client';

import * as React from 'react';
import { Card, Button } from '@/components/zoruui';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ActivityError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('Activity Page Error:', error);
  }, [error]);

  return (
    <div className="flex h-[50vh] w-full items-center justify-center p-6">
      <Card className="flex max-w-md flex-col items-center p-8 text-center shadow-sm">
        <div className="mb-4 rounded-full bg-zoru-danger-surface p-3">
          <AlertCircle className="h-6 w-6 text-zoru-danger-ink" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-zoru-ink">Something went wrong</h2>
        <p className="mb-6 text-sm text-zoru-ink-muted">
          We encountered an error loading the activity feed. This could be due to a network issue or missing data.
        </p>
        <Button onClick={() => reset()} className="w-full sm:w-auto">
          <RefreshCw className="mr-2 h-4 w-4" /> Try again
        </Button>
      </Card>
    </div>
  );
}
