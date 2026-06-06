'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';
import { AlertCircle } from 'lucide-react';

export default function DripCampaignsError({
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
    <div className="flex h-[400px] flex-col items-center justify-center space-y-4 rounded-md border border-dashed p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/20">
        <AlertCircle className="h-6 w-6 text-[var(--st-text)] dark:text-[var(--st-text)]" />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Something went wrong!</h2>
        <p className="text-sm text-[var(--st-text-secondary)]">
          Failed to load drip campaigns data. Please try again.
        </p>
      </div>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}
