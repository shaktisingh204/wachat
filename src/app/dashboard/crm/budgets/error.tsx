'use client';

import { Button } from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function BudgetsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <EntityListShell
      title="Budgets & Forecasting"
      subtitle="Track revenue and expense targets against actuals."
    >
      <div className="flex flex-col items-center justify-center rounded-lg border border-zoru-line bg-zoru-surface py-12 text-center">
        <h2 className="text-lg font-medium text-zoru-ink">Something went wrong!</h2>
        <p className="mt-2 text-[13px] text-zoru-ink-muted">
          {error.message || 'An unexpected error occurred while loading budgets.'}
        </p>
        <Button onClick={() => reset()} className="mt-4">
          Try again
        </Button>
      </div>
    </EntityListShell>
  );
}
