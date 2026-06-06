'use client';

import { useEffect } from 'react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { AlertCircle } from 'lucide-react';

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
    <div className="flex h-[400px] w-full items-center justify-center">
      <EmptyState
        icon={AlertCircle}
        tone="danger"
        title="Something went wrong"
        description={
          error.message || 'An unexpected error occurred while loading this page.'
        }
        action={
          <Button onClick={reset} variant="outline">
            Try again
          </Button>
        }
      />
    </div>
  );
}
