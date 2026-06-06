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
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <h2 className="text-xl font-mono font-bold text-[var(--st-text)]">Something went wrong!</h2>
      <p className="text-sm text-[var(--st-text)] font-mono">{error.message || 'An unexpected error occurred while loading the documentation.'}</p>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
