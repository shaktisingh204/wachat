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
    console.error('Banking all error:', error);
  }, [error]);

  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink/20 dark:text-zoru-ink">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div className="max-w-md">
        <h2 className="mb-2 text-lg font-semibold text-zoru-ink">Failed to load banking accounts</h2>
        <p className="mb-6 text-sm text-zoru-ink-muted">
          {error.message || 'An unexpected error occurred while loading banking accounts. Please try again.'}
        </p>
        <Button onClick={() => reset()} variant="default">
          Try again
        </Button>
      </div>
    </div>
  );
}
