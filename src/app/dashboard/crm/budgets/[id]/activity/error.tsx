'use client';

import { Button } from '@/components/sabcrm/20ui/compat';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { useParams } from 'next/navigation';

export default function BudgetActivityError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const id = params?.id as string;
  
  return (
    <EntityDetailShell
      eyebrow="ERROR"
      title="Failed to load budget activity"
      back={{ href: `/dashboard/crm/budgets/${id}`, label: 'Back to budget' }}
    >
      <div className="flex flex-col items-center justify-center rounded-lg border border-zoru-line bg-zoru-surface py-12 text-center">
        <h2 className="text-lg font-medium text-zoru-ink">Something went wrong!</h2>
        <p className="mt-2 text-[13px] text-zoru-ink-muted">
          {error.message || 'An unexpected error occurred while loading this activity timeline.'}
        </p>
        <Button onClick={() => reset()} className="mt-4">
          Try again
        </Button>
      </div>
    </EntityDetailShell>
  );
}
