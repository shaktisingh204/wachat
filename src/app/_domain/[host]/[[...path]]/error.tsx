'use client';

import * as React from 'react';
import { Button } from '@/components/zoruui';

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
    <div className="flex flex-col gap-4 p-6 zoruui min-h-screen bg-zoru-bg text-zoru-ink items-center justify-center">
      <div className="text-zoru-ink font-semibold text-lg">{error.message || 'An unexpected error occurred while loading this domain.'}</div>
      <div>
        <Button onClick={() => reset()} variant="outline">
          Try again
        </Button>
      </div>
    </div>
  );
}
