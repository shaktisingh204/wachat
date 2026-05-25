'use client';

import { Button } from '@/components/zoruui';
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
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center rounded-lg border border-zoru-line bg-zoru-surface">
        <div className="rounded-full bg-red-100 p-3 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-medium text-zoru-ink">
            Something went wrong!
          </h2>
          <p className="text-[13px] text-zoru-ink-muted">
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
