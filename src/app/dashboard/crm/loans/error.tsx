'use client';

import { Button } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function LoansError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Loans Error Boundary caught an error:', error);
  }, [error]);

  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-red-100 p-3 text-red-600 dark:bg-red-900/20 dark:text-red-400">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-medium text-zoru-ink">
          Something went wrong loading the loans data
        </h2>
        <p className="text-[13px] text-zoru-ink-muted">
          There was an error communicating with the database. Please try again.
        </p>
      </div>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
