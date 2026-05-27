'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';

export default function ProductionOrderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('ProductionOrderError:', error);
  }, [error]);

  return (
    <div className="flex h-[50vh] w-full flex-col items-center justify-center gap-4 rounded-lg border border-zoru-line bg-zoru-surface-2 p-6 text-center dark:border-zoru-line/50 dark:bg-zoru-ink/10">
      <div className="text-zoru-ink dark:text-zoru-ink-muted">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mx-auto mb-2 h-8 w-8"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <h2 className="text-lg font-semibold">Failed to load Production Order</h2>
        <p className="mt-1 text-sm opacity-80">
          {error.message || 'An unexpected error occurred while loading this order.'}
        </p>
      </div>
      <Button variant="outline" onClick={() => reset()} className="mt-2">
        Try again
      </Button>
    </div>
  );
}
