'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => {
    console.error('Performance Reviews Error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-lg border shadow-sm space-y-4">
      <h2 className="text-xl font-semibold text-[var(--st-text)]">Something went wrong!</h2>
      <p className="text-[var(--st-text)] max-w-md">
        We encountered an error while loading the performance reviews. Please try again.
      </p>
      <div className="text-sm text-[var(--st-text)] bg-[var(--st-bg-muted)] p-2 rounded w-full max-w-md overflow-auto text-left">
        {error.message}
      </div>
      <Button onClick={() => reset()} variant="default">
        Try again
      </Button>
    </div>
  );
}
