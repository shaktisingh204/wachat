'use client';

import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function NewStockTransferError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('New Stock Transfer Error Boundary caught an error:', error);
  }, [error]);

  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-[var(--st-bg-muted)] p-3 text-[var(--st-text)] dark:bg-[var(--st-text)]/20 dark:text-[var(--st-text-secondary)]">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-medium text-[var(--st-text)]">
          Something went wrong loading the form
        </h2>
        <p className="text-[13px] text-[var(--st-text-secondary)]">
          There was an error initializing the stock transfer creation page. Please try again.
        </p>
      </div>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
