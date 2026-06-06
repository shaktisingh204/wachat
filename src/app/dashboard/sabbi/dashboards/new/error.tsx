'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function DashboardNewError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard creation error:', error);
  }, [error]);

  return (
    <div className="flex h-[400px] w-full flex-col items-center justify-center space-y-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-danger-bg">
        <AlertCircle className="h-6 w-6 text-zoru-danger-ink" />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-zoru-ink">
          Failed to load dashboard form
        </h2>
        <p className="text-sm text-zoru-ink-muted">
          An error occurred while loading this page.
        </p>
        {error?.message && (
          <p className="text-xs text-zoru-ink-muted bg-zoru-surface p-2 rounded-md max-w-md mx-auto truncate">
            {error.message}
          </p>
        )}
      </div>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}
