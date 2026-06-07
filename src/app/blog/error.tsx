'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function BlogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="ui20 dark min-h-screen flex flex-col items-center justify-center bg-[var(--st-bg)] p-8">
      <EmptyState
        tone="danger"
        icon={AlertTriangle}
        title="Something went wrong"
        description="We encountered an error while loading the changelog content."
        action={
          <Button variant="primary" iconLeft={RotateCw} onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
