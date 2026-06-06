'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertTriangle } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Loan creation error:', error);
  }, [error]);

  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/20 dark:text-[var(--st-text)]">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div className="max-w-md">
        <h2 className="mb-2 text-lg font-semibold text-[var(--st-text)]">Something went wrong!</h2>
        <p className="mb-6 text-sm text-[var(--st-text-secondary)]">
          We encountered an error loading the new loan page. Please try again.
        </p>
        <Button onClick={() => reset()} variant="default">
          Try again
        </Button>
      </div>
    </div>
  );
}
