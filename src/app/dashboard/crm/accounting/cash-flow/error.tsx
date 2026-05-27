'use client';

import { Button } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function CashFlowError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Cash Flow Error Boundary caught an error:', error);
  }, [error]);

  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-zoru-surface-2 p-3 text-zoru-ink dark:bg-zoru-ink/20 dark:text-zoru-ink-muted">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-medium text-zoru-ink">
          Something went wrong loading the cash flow statement
        </h2>
        <p className="text-[13px] text-zoru-ink-muted">
          There was an error generating the report. Please try again.
        </p>
      </div>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
