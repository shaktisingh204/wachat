'use client';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Button } from '@/components/sabcrm/20ui/compat';
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
      <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 py-12 px-4 text-center dark:border-[var(--st-border)]/50 dark:bg-[var(--st-text)]/10">
        <AlertCircle className="mb-4 h-10 w-10 text-[var(--st-text)]" />
        <h3 className="mb-2 text-lg font-medium text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
          Failed to load activity
        </h3>
        <p className="mb-6 max-w-md text-sm text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
          {error.message || 'An unexpected error occurred while loading the adjustment activity timeline.'}
        </p>
        <Button onClick={() => reset()} variant="outline" className="border-[var(--st-border)] hover:bg-[var(--st-bg-muted)] dark:border-[var(--st-border)] dark:hover:bg-[var(--st-text)]/20">
          Try Again
        </Button>
      </div>
    </EntityDetailShell>
  );
}
