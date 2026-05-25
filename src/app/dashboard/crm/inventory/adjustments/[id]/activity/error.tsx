'use client';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Button } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function StockAdjustmentActivityError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('StockAdjustmentActivityPage error:', error);
  }, [error]);

  return (
    <EntityDetailShell
      title="Error Loading Activity"
      eyebrow="STOCK ADJUSTMENT ACTIVITY"
      back={{
        href: '#',
        label: 'Back to adjustment',
      }}
    >
      <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50/50 py-12 px-4 text-center dark:border-red-900/50 dark:bg-red-900/10">
        <AlertCircle className="mb-4 h-10 w-10 text-red-500" />
        <h3 className="mb-2 text-lg font-medium text-red-800 dark:text-red-300">
          Failed to load activity
        </h3>
        <p className="mb-6 max-w-md text-sm text-red-600 dark:text-red-400">
          {error.message || 'An unexpected error occurred while loading the adjustment activity timeline.'}
        </p>
        <Button onClick={() => reset()} variant="outline" className="border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20">
          Try Again
        </Button>
      </div>
    </EntityDetailShell>
  );
}
