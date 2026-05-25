'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';

export default function ErrorPage({
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
    <div className="flex h-[400px] flex-col items-center justify-center space-y-4">
      <h2 className="text-xl font-semibold">Something went wrong!</h2>
      <p className="text-sm text-zoru-ink-muted">{error.message || 'An unexpected error occurred.'}</p>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}