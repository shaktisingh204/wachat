'use client';

import * as React from 'react';
import { Button } from '@/components/zoruui/button';
import { AlertTriangle } from 'lucide-react';

export default function KpiTrackingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('KPI Tracking page error:', error);
  }, [error]);

  return (
    <div className="flex h-[400px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-8 text-center bg-background">
      <AlertTriangle className="h-10 w-10 text-red-500" />
      <div className="space-y-1">
        <h2 className="text-lg font-medium">Failed to load KPIs</h2>
        <p className="text-sm text-muted-foreground">
          {error.message || 'An unexpected error occurred while fetching your data.'}
        </p>
      </div>
      <Button onClick={reset} variant="default">
        Try Again
      </Button>
    </div>
  );
}
