'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';

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
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8 text-center bg-zoru-surface-2/30">
      <h2 className="text-xl font-semibold text-zoru-ink">Something went wrong!</h2>
      <p className="text-sm text-zoru-ink-muted max-w-md">
        {error.message || 'An unexpected error occurred while loading batch expiries.'}
      </p>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
