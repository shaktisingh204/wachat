'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="20ui flex min-h-[400px] flex-col items-center justify-center p-6">
      <EmptyState
        icon={AlertTriangle}
        tone="danger"
        title="Something went wrong"
        description="An error occurred while loading the Ad Sets. Please try again, or contact support if the issue persists."
        action={
          <Button variant="primary" iconLeft={RotateCcw} onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
