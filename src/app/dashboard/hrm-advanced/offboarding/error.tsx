'use client';

import { Button } from '@/components/sabcrm/20ui';
import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Offboarding module error:', error);
  }, [error]);

  return (
    <div className="p-8 flex flex-col items-center justify-center space-y-4">
      <h2 className="text-xl font-semibold text-[var(--st-text)]">Something went wrong fetching offboarding data!</h2>
      <p className="text-sm text-[var(--st-text-secondary)]">{error.message}</p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
