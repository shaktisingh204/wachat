'use client';

import React, { useEffect } from 'react';
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
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-[400px] w-full flex-col items-center justify-center space-y-4 rounded-lg border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] p-8 text-center dark:border-[var(--st-border)] dark:bg-[var(--st-text)]/10">
      <AlertCircle className="h-10 w-10 text-[var(--st-text)]" />
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
          Something went wrong loading campaigns!
        </h2>
        <p className="text-sm text-[var(--st-text)] dark:text-[var(--st-text)]">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
      </div>
      <Button 
        onClick={() => reset()}
        variant="outline"
        className="mt-4 border-[var(--st-border)] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)] dark:border-[var(--st-border)] dark:text-[var(--st-text-secondary)] dark:hover:bg-[var(--st-text)]/20"
      >
        Try again
      </Button>
    </div>
  );
}
