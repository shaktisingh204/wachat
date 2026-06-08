'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function SabcreatorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[sabcreator] route error', error);
  }, [error]);

  return (
    <main className="20ui mx-auto max-w-[640px] px-6 py-16">
      <EmptyState
        icon={AlertTriangle}
        title="Something went wrong"
        description="We couldn't load this SabCreator view. Please try again."
        action={
          <Button variant="primary" iconLeft={RotateCw} onClick={reset}>
            Try again
          </Button>
        }
      />
    </main>
  );
}
