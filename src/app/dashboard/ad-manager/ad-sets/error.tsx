'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';

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
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 space-y-4 text-center zoruui">
      <h2 className="text-xl font-semibold tracking-tight">Something went wrong!</h2>
      <p className="text-sm text-[var(--st-text-secondary)] max-w-[500px]">
        An error occurred while loading the Ad Sets. Please try again or contact support if the issue persists.
      </p>
      <Button onClick={() => reset()} variant="default">
        Try again
      </Button>
    </div>
  );
}
