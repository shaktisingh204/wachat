'use client';

import { Button } from '@/components/zoruui';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <h2 className="text-xl font-bold text-zoru-ink">Something went wrong!</h2>
      <p className="text-sm text-zoru-ink-dim">{error.message || 'An unexpected error occurred.'}</p>
      <Button onClick={() => reset()} variant="primary">
        Try again
      </Button>
    </div>
  );
}
