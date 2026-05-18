'use client';

import { ZoruButton, ZoruEmptyState } from '@/components/zoruui';
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
      <ZoruEmptyState
        icon={<AlertTriangle />}
        title="Something went wrong"
        description={
          error?.message?.length && error.message.length < 200
            ? error.message
            : 'A SabWa page hit an unexpected error. Try again or head back to overview.'
        }
        action={
          <div className="flex items-center gap-2">
            <ZoruButton size="md" onClick={() => reset()}>
              Try again
            </ZoruButton>
            <Link href="/sabwa/overview">
              <ZoruButton size="md" variant="outline">
                Back to overview
              </ZoruButton>
            </Link>
          </div>
        }
      />
    </div>
  );
}
