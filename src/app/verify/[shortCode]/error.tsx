'use client';

import { useEffect } from 'react';
import { Button, Card } from '@/components/sabcrm/20ui/compat';
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
    <div className="flex min-h-screen items-center justify-center bg-[var(--st-text)] px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-danger)]/10">
            <AlertCircle className="h-6 w-6 text-[var(--st-danger)]" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-[var(--st-text)]">Something went wrong</h2>
            <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
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
