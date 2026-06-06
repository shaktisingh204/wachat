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
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 space-y-4">
      <h2 className="text-xl font-semibold text-[var(--st-text)]">Something went wrong!</h2>
      <p className="text-[var(--st-text-secondary)] text-sm max-w-[500px] text-center">
        {error.message || 'An unexpected error occurred while loading this page.'}
      </p>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
