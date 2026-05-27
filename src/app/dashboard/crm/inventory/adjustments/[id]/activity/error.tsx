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
      <div className="flex flex-col items-center justify-center rounded-lg border border-zoru-line bg-zoru-surface-2/50 py-12 px-4 text-center dark:border-zoru-line/50 dark:bg-zoru-ink/10">
        <AlertCircle className="mb-4 h-10 w-10 text-zoru-ink" />
        <h3 className="mb-2 text-lg font-medium text-zoru-ink dark:text-zoru-ink-muted">
          Failed to load activity
        </h3>
        <p className="mb-6 max-w-md text-sm text-zoru-ink dark:text-zoru-ink-muted">
          {error.message || 'An unexpected error occurred while loading the adjustment activity timeline.'}
        </p>
        <Button onClick={() => reset()} variant="outline" className="border-zoru-line hover:bg-zoru-surface-2 dark:border-zoru-line dark:hover:bg-zoru-ink/20">
          Try Again
        </Button>
      </div>
    </EntityDetailShell>
  );
}
