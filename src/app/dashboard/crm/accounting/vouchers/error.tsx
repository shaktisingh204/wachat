'use client';

import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { AlertTriangle } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

export default function VouchersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[CRM Accounting Vouchers] route error', error);
  }, [error]);

  return (
    <div className="w-full px-6 pt-6 pb-10 flex-1">
      <EmptyState
        icon={<AlertTriangle className="text-[var(--st-text)] h-8 w-8" />}
        title="Unable to load Vouchers"
        description={
          error?.message?.length && error.message.length < 200
            ? error.message
            : 'An unexpected error occurred while loading the Vouchers module.'
        }
        action={
          <div className="flex items-center gap-2 mt-4">
            <Button size="md" onClick={() => reset()}>
              Try again
            </Button>
            <Link href="/dashboard/crm/accounting">
              <Button size="md" variant="outline">
                Back to Accounting
              </Button>
            </Link>
          </div>
        }
      />
    </div>
  );
}
