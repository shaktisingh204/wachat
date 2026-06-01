'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, EmptyState } from '@/components/zoruui';

export default function SabcrmError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('SabCRM Error:', error);
  }, [error]);

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">
      <EmptyState
        icon={<AlertTriangle className="text-zoru-danger" />}
        title="Something went wrong in SabCRM"
        description={
          error?.message ||
          'An unexpected error occurred while loading SabCRM. Please try again or contact support if the issue persists.'
        }
        action={
          <Button onClick={() => reset()} variant="default">
            Try again
          </Button>
        }
      />
    </main>
  );
}
