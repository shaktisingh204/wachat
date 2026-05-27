'use client';

import { useEffect } from 'react';
import { Button, EmptyState } from '@/components/zoruui';
import { AlertTriangle } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('API Hub error:', error);
  }, [error]);

  return (
    <div className="flex h-full min-h-[400px] w-full flex-col items-center justify-center p-6">
      <EmptyState
        icon={<AlertTriangle className="text-zoru-ink" />}
        title="Something went wrong!"
        description={error.message || 'An unexpected error occurred while loading the API Hub.'}
        action={
          <Button onClick={() => reset()} variant="outline">
            Try again
          </Button>
        }
      />
    </div>
  );
}
