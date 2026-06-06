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
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-danger-soft)]">
        <AlertCircle className="h-6 w-6 text-[var(--st-danger)]" />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--st-text)]">
          Failed to load dashboard form
        </h2>
        <p className="text-sm text-[var(--st-text-secondary)]">
          An error occurred while loading this page.
        </p>
        {error?.message && (
          <p className="text-xs text-[var(--st-text-secondary)] bg-[var(--st-bg-secondary)] p-2 rounded-md max-w-md mx-auto truncate">
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
