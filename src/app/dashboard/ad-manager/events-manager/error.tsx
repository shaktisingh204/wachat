'use client';

import * as React from 'react';
import { AmErrorAlert } from '../_components/am-page-shell';
import { Button } from '@/components/sabcrm/20ui';

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
      <AmErrorAlert message={error.message || 'An unexpected error occurred in Events Manager.'} />
      <div>
        <Button onClick={() => reset()} variant="outline">
          Try again
        </Button>
      </div>
    </div>
  );
}
