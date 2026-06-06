'use client';

import * as React from 'react';
import { Button } from '@/components/sabcrm/20ui';

export default function DomainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[Domain ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="flex flex-col gap-4 p-6 zoruui min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] items-center justify-center">
      <div className="text-[var(--st-text)] font-semibold text-lg">{error.message || 'An unexpected error occurred while loading this domain.'}</div>
      <div>
        <Button onClick={() => reset()} variant="outline">
          Try again
        </Button>
      </div>
    </div>
  );
}
