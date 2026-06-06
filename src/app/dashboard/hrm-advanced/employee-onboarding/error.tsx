'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';
import { AlertTriangle } from 'lucide-react';

export default function ErrorBoundary({
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
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-[var(--st-bg-secondary)] rounded-lg border border-destructive/20 space-y-4">
      <div className="p-3 bg-[var(--st-text)]/10 rounded-full">
        <AlertTriangle className="w-8 h-8 text-[var(--st-text)]" />
      </div>
      <h2 className="text-xl font-semibold text-center">Something went wrong!</h2>
      <p className="text-[var(--st-text-secondary)] text-center max-w-md">
        Failed to load the employee onboarding tasks. This could be due to a network issue or missing permissions.
      </p>
      <p className="text-sm text-[var(--st-text-secondary)]/80 font-mono bg-[var(--st-bg-muted)] p-2 rounded">
        {error.message || 'Unknown error occurred'}
      </p>
      <Button onClick={reset} variant="default">
        Try again
      </Button>
    </div>
  );
}
