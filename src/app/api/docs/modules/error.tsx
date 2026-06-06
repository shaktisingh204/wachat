'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="zoruui min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)] p-6 shadow-sm text-center">
        <h2 className="text-xl font-semibold mb-2">Something went wrong!</h2>
        <p className="text-sm text-[var(--st-text-secondary)] mb-6">
          There was an error loading the API modules directory.
        </p>
        <Button onClick={() => reset()} variant="default" className="w-full">
          Try again
        </Button>
      </div>
    </div>
  );
}
