'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Base64ToImagePage error:', error);
  }, [error]);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold text-[var(--st-text)]">Something went wrong!</h2>
      <p className="text-sm text-[var(--st-text-secondary)]">{error.message || 'An unexpected error occurred.'}</p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
