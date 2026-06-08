'use client';

import React, { useEffect } from 'react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service.
    console.error(error);
  }, [error]);

  return (
    <div className="20ui flex min-h-[400px] w-full items-center justify-center p-8">
      <EmptyState
        icon={AlertCircle}
        tone="danger"
        title="Something went wrong loading campaigns"
        description={error.message || 'An unexpected error occurred. Please try again.'}
        action={
          <Button variant="primary" iconLeft={RefreshCw} onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
