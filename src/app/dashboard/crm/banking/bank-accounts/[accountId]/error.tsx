'use client';

import { Button, EmptyState } from '@/components/zoruui';
import { AlertTriangle } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

export default function BankAccountDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[crm/banking] detail route error', error);
  }, [error]);

  return (
    <div className="w-full px-6 pt-6 pb-10">
      <EmptyState
        icon={<AlertTriangle />}
        title="Failed to load account"
        description={
          error?.message?.length && error.message.length < 200
            ? error.message
            : 'An unexpected error occurred while loading this bank account detail. Please try again.'
        }
        action={
          <div className="flex items-center gap-2">
            <Button size="md" onClick={() => reset()}>
              Try again
            </Button>
            <Link href="/dashboard/crm/banking/bank-accounts">
              <Button size="md" variant="outline">
                Back to Bank Accounts
              </Button>
            </Link>
          </div>
        }
      />
    </div>
  );
}
