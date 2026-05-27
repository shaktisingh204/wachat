'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/zoruui';
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
    <div className="flex h-[400px] w-full flex-col items-center justify-center space-y-4 rounded-lg border border-dashed border-zoru-line bg-zoru-surface-2 p-8 text-center dark:border-zoru-line dark:bg-zoru-ink/10">
      <AlertCircle className="h-10 w-10 text-zoru-ink" />
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-zoru-ink dark:text-zoru-ink-muted">
          Something went wrong loading campaigns!
        </h2>
        <p className="text-sm text-zoru-ink dark:text-zoru-ink">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
      </div>
      <Button 
        onClick={() => reset()}
        variant="outline"
        className="mt-4 border-zoru-line text-zoru-ink hover:bg-zoru-surface-2 hover:text-zoru-ink dark:border-zoru-line dark:text-zoru-ink-muted dark:hover:bg-zoru-ink/20"
      >
        Try again
      </Button>
    </div>
  );
}
