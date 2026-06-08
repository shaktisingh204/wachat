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
    console.error(error);
  }, [error]);

  return (
    <div className="20ui flex min-h-[400px] flex-col items-center justify-center p-8">
      <EmptyState
        icon={AlertTriangle}
        tone="danger"
        title="Something went wrong!"
        description={error.message || 'An unexpected error occurred while loading this page.'}
        action={
          <Button variant="outline" iconLeft={RotateCcw} onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
