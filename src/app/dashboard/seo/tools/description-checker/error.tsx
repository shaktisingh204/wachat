'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';

export default function Error({
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
    <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg border-destructive/20 bg-[var(--st-text)]/10">
      <h2 className="mb-2 text-lg font-semibold text-[var(--st-text)]">Something went wrong!</h2>
      <p className="mb-4 text-sm text-[var(--st-text-secondary)]">{error.message || 'An unexpected error occurred in the Description Checker.'}</p>
      <Button variant="outline" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
