'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';

export default function BatchExpiryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Batch Expiry Error:', error);
  }, [error]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8 text-center bg-[var(--st-bg-muted)]/30">
      <h2 className="text-xl font-semibold text-[var(--st-text)]">Something went wrong!</h2>
      <p className="text-sm text-[var(--st-text-secondary)] max-w-md">
        {error.message || 'An unexpected error occurred while loading batch expiries.'}
      </p>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
