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
    console.error('OKR Tracking Error:', error);
  }, [error]);

  return (
    <div className="flex h-[400px] flex-col items-center justify-center space-y-4 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-8 text-center dark:border-[var(--st-border)] dark:bg-[var(--st-text)]">
      <h2 className="text-xl font-semibold text-[var(--st-text)] dark:text-white">Something went wrong fetching OKRs!</h2>
      <p className="text-sm text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">{error.message}</p>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
