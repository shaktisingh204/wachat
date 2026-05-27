'use client';

import { useEffect } from 'react';
import { Button, Card } from '@/components/zoruui';
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
    <div className="flex h-full w-full items-center justify-center p-6">
      <Card className="flex max-w-md flex-col items-center p-8 text-center border-zoru-line bg-zoru-surface">
        <AlertCircle className="mb-4 h-12 w-12 text-zoru-ink" strokeWidth={1.5} />
        <h2 className="mb-2 text-xl font-bold text-zoru-ink">Something went wrong</h2>
        <p className="mb-6 text-sm text-zoru-ink-muted">
          We encountered an error while loading the lead details.
        </p>
        <Button onClick={() => reset()} variant="default">
          Try again
        </Button>
      </Card>
    </div>
  );
}
