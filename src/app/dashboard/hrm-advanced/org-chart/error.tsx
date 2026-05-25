'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';

export default function Error({
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
    <div className="flex h-full flex-col items-center justify-center p-8 text-center space-y-4">
      <h2 className="text-2xl font-semibold text-zoru-ink">Something went wrong!</h2>
      <p className="text-zoru-ink-muted max-w-md">Failed to load organization chart data. {error.message}</p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
