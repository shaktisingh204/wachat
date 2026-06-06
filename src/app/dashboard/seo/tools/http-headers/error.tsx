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
    console.error('[HTTP Headers Error]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="text-zoru-ink font-semibold text-lg">Something went wrong!</div>
      <p className="text-sm text-zoru-ink">{error.message}</p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
