'use client';

import { Button, EmptyState } from '@/components/zoruui';
import { AlertTriangle } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

export default function BankAccountsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[crm/banking] route error', error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10">
      <EmptyState
        icon={<AlertTriangle />}
        title="Something went wrong"
        description={
          error?.message?.length && error.message.length < 200
            ? error.message
            : 'An unexpected error occurred while loading the bank accounts. Please try again.'
        }
        action={
          <div className="flex items-center gap-2">
            <Button size="md" onClick={() => reset()}>
              Try again
            </Button>
            <Link href="/dashboard/crm/banking">
              <Button size="md" variant="outline">
                Back to Banking Hub
              </Button>
            </Link>
          </div>
        }
      />
    </div>
  );
}
