'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { AlertTriangle } from 'lucide-react';

export default function EditProductionOrderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('Edit production order route error', error);
  }, [error]);

  const params = useParams();
  const orderId = params?.orderId as string;

  return (
    <div className="w-full px-6 pt-6 pb-10">
      <EmptyState
        icon={<AlertTriangle className="h-6 w-6 text-[var(--st-text)]" />}
        title="Something went wrong"
        description={
          error?.message?.length && error.message.length < 200
            ? error.message
            : 'An unexpected error occurred while loading the edit production order page.'
        }
        action={
          <div className="flex items-center gap-2">
            <Button size="md" onClick={() => reset()}>
              Try again
            </Button>
            <Link href={orderId ? `/dashboard/crm/inventory/production-orders/${orderId}` : '/dashboard/crm/inventory/production-orders'}>
              <Button size="md" variant="outline">
                Go Back
              </Button>
            </Link>
          </div>
        }
      />
    </div>
  );
}
