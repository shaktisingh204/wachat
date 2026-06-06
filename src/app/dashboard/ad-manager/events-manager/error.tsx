'use client';

import * as React from 'react';
import { RotateCw } from 'lucide-react';
import { Alert, Button } from '@/components/sabcrm/20ui';

export default function EventsManagerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[EventsManager ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <Alert tone="danger" title="Something went wrong">
        {error.message || 'An unexpected error occurred in Events Manager.'}
      </Alert>
      <div>
        <Button variant="outline" iconLeft={RotateCw} onClick={() => reset()}>
          Try again
        </Button>
      </div>
    </div>
  );
}
