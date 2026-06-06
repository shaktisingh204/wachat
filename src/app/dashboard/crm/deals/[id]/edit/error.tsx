'use client';

import { useEffect } from 'react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function LegacyDealEditError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[legacy-deal-edit] route error', error);
  }, [error]);

  return (
    <div className="w-full px-6 pt-6 pb-10">
      <EmptyState
        icon={<AlertTriangle className="h-8 w-8 text-[var(--st-text)]" />}
        title="Redirection Failed"
        description={
          error?.message?.length && error.message.length < 200
            ? error.message
            : 'We encountered an error while redirecting to the latest deal edit page. Please try again or head back to the deals list.'
        }
        action={
          <div className="flex items-center gap-4 mt-4">
            <Button size="md" onClick={() => reset()}>
              Try again
            </Button>
            <Link href="/dashboard/crm/sales-crm/deals">
              <Button size="md" variant="outline">
                Back to Deals
              </Button>
            </Link>
          </div>
        }
      />
    </div>
  );
}
