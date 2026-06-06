'use client';

import { Button } from '@/components/sabcrm/20ui/compat';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function BudgetDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Budget Detail Error Boundary caught an error:', error);
  }, [error]);

  return (
    <EntityDetailShell
      eyebrow="ERROR"
      title="Failed to load budget"
      back={{ href: '/dashboard/crm/budgets', label: 'Back to budgets' }}
    >
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <div className="rounded-full bg-[var(--st-bg-muted)] p-3 text-[var(--st-text)] dark:bg-[var(--st-text)]/20 dark:text-[var(--st-text-secondary)]">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-medium text-[var(--st-text)]">
            Something went wrong!
          </h2>
          <p className="text-[13px] text-[var(--st-text-secondary)]">
            {error.message || 'An unexpected error occurred while loading this budget.'}
          </p>
        </div>
        <Button onClick={() => reset()} variant="outline" className="mt-2">
          Try again
        </Button>
      </div>
    </EntityDetailShell>
  );
}
