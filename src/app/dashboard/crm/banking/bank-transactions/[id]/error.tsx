'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertTriangle } from 'lucide-react';

export default function BankTransactionDetailErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Bank Transaction Detail error:', error);
  }, [error]);

  return (
    <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4 rounded-[var(--zoru-radius-lg)] border border-[var(--st-border)] border-dashed p-8 text-center bg-[var(--st-bg-secondary)]/50">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/20 dark:text-[var(--st-text)]">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-[var(--st-text)]">Something went wrong!</h2>
      <p className="text-[13px] text-[var(--st-text-secondary)] max-w-[400px]">
        {error.message || 'We encountered an error loading this bank transaction. Please try again.'}
      </p>
      <Button onClick={() => reset()} variant="outline" className="mt-2 h-9">
        Try again
      </Button>
    </div>
  );
}
