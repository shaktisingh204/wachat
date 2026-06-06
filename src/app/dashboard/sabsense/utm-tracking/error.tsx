'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-[400px] w-full flex-col items-center justify-center space-y-4 rounded-[var(--zoru-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 p-8 text-center dark:bg-[var(--st-text)]/10">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/20">
        <AlertCircle className="h-6 w-6 text-[var(--st-text)] dark:text-[var(--st-text-secondary)]" />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[var(--st-text)] dark:text-white">
          Something went wrong!
        </h2>
        <p className="text-sm text-[var(--st-text)] dark:text-[var(--st-text-secondary)] max-w-md mx-auto">
          {error.message || 'An unexpected error occurred while loading this page.'}
        </p>
      </div>
      <Button onClick={reset} variant="outline" className="mt-4">
        Try again
      </Button>
    </div>
  );
}
