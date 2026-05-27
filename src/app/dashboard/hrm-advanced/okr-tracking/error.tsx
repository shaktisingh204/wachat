'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('OKR Tracking Error:', error);
  }, [error]);

  return (
    <div className="flex h-[400px] flex-col items-center justify-center space-y-4 rounded-md border border-zoru-line bg-zoru-surface-2 p-8 text-center dark:border-zoru-line dark:bg-zoru-ink">
      <h2 className="text-xl font-semibold text-zoru-ink dark:text-white">Something went wrong fetching OKRs!</h2>
      <p className="text-sm text-zoru-ink dark:text-zoru-ink-muted">{error.message}</p>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
