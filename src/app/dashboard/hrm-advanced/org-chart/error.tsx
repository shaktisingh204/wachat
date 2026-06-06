'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';

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
      <h2 className="text-2xl font-semibold text-[var(--st-text)]">Something went wrong!</h2>
      <p className="text-[var(--st-text-secondary)] max-w-md">Failed to load organization chart data. {error.message}</p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
