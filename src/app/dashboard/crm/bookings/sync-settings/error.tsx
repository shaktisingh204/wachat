'use client';

import * as React from 'react';
import { Button } from '@/components/sabcrm/20ui';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('Sync Settings Error:', error);
  }, [error]);

  return (
    <div className="flex h-[400px] w-full flex-col items-center justify-center space-y-4 rounded-xl border border-[var(--st-border)] border-dashed bg-[var(--st-bg-secondary)] p-8 text-center animate-in fade-in-50 duration-500">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/30 dark:text-[var(--st-text-secondary)]">
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
          className="h-6 w-6"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-medium text-[var(--st-text)]">Failed to load Sync Settings</h3>
        <p className="text-sm text-[var(--st-text-secondary)] max-w-[400px]">
          There was an error loading the calendar integration settings. Please try again or contact support if the issue persists.
        </p>
      </div>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
