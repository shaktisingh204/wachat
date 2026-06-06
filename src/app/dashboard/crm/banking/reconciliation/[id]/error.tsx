'use client';

import { Button, EmptyState } from '@/components/sabcrm/20ui/compat';
import { AlertTriangle } from 'lucide-react';
import * as React from 'react';
import Link from 'next/link';

export default function ReconciliationDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[CRM Banking Reconciliation Detail] route error', error);
  }, [error]);

  return (
    <div className="flex h-full min-h-[500px] w-full items-center justify-center p-6">
      <EmptyState
        icon={<AlertTriangle className="text-[var(--st-text)] h-8 w-8" />}
        title="Unable to load Reconciliation"
        description={
          error?.message?.length && error.message.length < 200
            ? error.message
            : 'An unexpected error occurred while loading the reconciliation detail. Please try again or go back.'
        }
        action={
          <div className="flex flex-col items-center gap-3 sm:flex-row mt-2">
            <Button onClick={() => reset()} variant="default">
              Try again
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/crm/banking/reconciliation">
                Back to Reconciliations
              </Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
