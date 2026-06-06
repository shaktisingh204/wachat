'use client';

import React from 'react';
import { Button } from '@/components/sabcrm/20ui';

export default function ExpensePolicyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-[var(--st-bg-muted)] p-4">
        <svg
          className="h-8 w-8 text-[var(--st-text)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold">Failed to load expense claims</h2>
      <p className="max-w-md text-sm text-[var(--st-text-secondary)]">
        {error.message || 'An unexpected error occurred while fetching expense policy data.'}
      </p>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
