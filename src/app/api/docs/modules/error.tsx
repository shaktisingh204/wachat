'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="zoruui min-h-screen bg-zoru-bg text-zoru-ink flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-zoru-surface border border-zoru-line rounded-[var(--zoru-radius)] p-6 shadow-sm text-center">
        <h2 className="text-xl font-semibold mb-2">Something went wrong!</h2>
        <p className="text-sm text-zoru-ink-muted mb-6">
          There was an error loading the API modules directory.
        </p>
        <Button onClick={() => reset()} variant="default" className="w-full">
          Try again
        </Button>
      </div>
    </div>
  );
}
