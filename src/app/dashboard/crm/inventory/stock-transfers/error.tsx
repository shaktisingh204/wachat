'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';
import { AlertCircle } from 'lucide-react';

export default function StockTransfersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Stock Transfers Route Error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border rounded-[var(--st-radius)] border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
      <AlertCircle className="mb-4 h-10 w-10 text-[var(--st-danger)]" />
      <h2 className="mb-2 text-lg font-semibold text-[var(--st-text)]">Failed to load stock transfers</h2>
      <p className="mb-4 text-sm text-[var(--st-text-secondary)]">
        {error.message || 'An unexpected error occurred while loading this module.'}
      </p>
      <Button variant="outline" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
