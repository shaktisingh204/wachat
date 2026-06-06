'use client';

import { useEffect } from 'react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function ShiftRotationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ShiftRotationsError]', error);
  }, [error]);

  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <EmptyState
        title="Failed to load shift rotations"
        description={error.message || 'Something went wrong while fetching shift rotations data.'}
        action={
          <Button onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
