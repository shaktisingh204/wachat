'use client';

import { useEffect } from 'react';
import { Button, Card } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function DealsError({
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
    <div className="flex h-full w-full items-center justify-center p-6">
      <Card className="flex max-w-md flex-col items-center p-6 text-center shadow-md">
        <AlertCircle className="mb-4 h-10 w-10 text-zoru-danger-ink" />
        <h2 className="mb-2 text-lg font-semibold text-zoru-ink">Something went wrong!</h2>
        <p className="mb-6 text-sm text-zoru-ink-muted">
          {error.message || 'An unexpected error occurred while loading deals.'}
        </p>
        <Button onClick={() => reset()} variant="default">
          Try again
        </Button>
      </Card>
    </div>
  );
}
