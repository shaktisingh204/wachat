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
    console.error('Verify Link Error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-danger-ink/10">
            <AlertCircle className="h-6 w-6 text-zoru-danger-ink" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-zoru-ink">Something went wrong</h2>
            <p className="mt-1 text-sm text-zoru-ink-muted">
              Failed to load verification page.
            </p>
          </div>
          <Button onClick={() => reset()} className="mt-4 w-full">
            Try again
          </Button>
        </div>
      </Card>
    </div>
  );
}
