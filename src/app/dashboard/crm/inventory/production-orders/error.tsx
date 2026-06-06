'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';
import { AlertCircle } from 'lucide-react';

export default function ProductionOrdersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-[var(--st-danger)]/5 rounded-lg border border-[var(--st-danger)]/20 m-6">
      <AlertCircle className="w-10 h-10 text-[var(--st-danger)] mb-4" />
      <h2 className="text-lg font-bold text-[var(--st-danger)] mb-2">Something went wrong!</h2>
      <p className="text-sm text-[var(--st-text-secondary)] mb-4 max-w-md">
        {error?.message || 'An unexpected error occurred loading production orders.'}
      </p>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
