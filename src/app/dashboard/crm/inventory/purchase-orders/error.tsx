'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';

export default function PurchaseOrdersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Purchase Orders page error:', error);
  }, [error]);

  return (
    <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8 text-center">
      <h2 className="text-xl font-semibold text-zoru-ink">Failed to load purchase orders</h2>
      <p className="text-sm text-zoru-ink-muted">
        {error.message || 'An unexpected error occurred while fetching purchase orders.'}
      </p>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
