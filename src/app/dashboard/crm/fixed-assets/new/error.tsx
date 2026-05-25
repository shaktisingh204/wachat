'use client';

import { useEffect } from 'react';
import { Button, Card } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';

export default function NewFixedAssetError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('New fixed asset error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] w-full items-center justify-center p-6">
      <Card className="flex max-w-md flex-col items-center justify-center p-8 text-center shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zoru-danger-bg text-zoru-danger-ink">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="mb-2 text-xl font-semibold tracking-tight text-zoru-ink">
          Failed to load new fixed asset form
        </h2>
        <p className="mb-6 text-sm text-zoru-ink-muted">
          {error.message || 'An unexpected error occurred while preparing the form.'}
        </p>
        <Button onClick={() => reset()} variant="default">
          Try again
        </Button>
      </Card>
    </div>
  );
}
