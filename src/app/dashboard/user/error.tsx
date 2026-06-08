'use client';

import { useEffect } from 'react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { AlertTriangle } from 'lucide-react';

export default function ErrorBoundary({
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
    <div className="mx-auto flex min-h-[400px] w-full max-w-5xl items-center justify-center px-4 py-6">
      <EmptyState
        icon={<AlertTriangle />}
        tone="danger"
        title="Something went wrong"
        description={
          error.message || 'An unexpected error occurred while loading your account.'
        }
        action={
          <Button variant="outline" onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
