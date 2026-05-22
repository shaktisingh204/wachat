'use client';

import { Button, EmptyState } from '@/components/zoruui';
import { AlertTriangle } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

export default function SabwaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[sabwa] route error', error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10">
      <EmptyState
        icon={<AlertTriangle />}
        title="Something went wrong"
        description={
          error?.message?.length && error.message.length < 200
            ? error.message
            : 'A SabWa page hit an unexpected error. Try again or head back to overview.'
        }
        action={
          <div className="flex items-center gap-2">
            <Button size="md" onClick={() => reset()}>
              Try again
            </Button>
            <Link href="/sabwa/overview">
              <Button size="md" variant="outline">
                Back to overview
              </Button>
            </Link>
          </div>
        }
      />
    </div>
  );
}
