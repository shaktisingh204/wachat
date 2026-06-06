'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';

import { Alert, Button } from '@/components/sabcrm/20ui';

export default function AdManagerCompareError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[AdManager Compare ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <Alert tone="danger" title="Something went wrong">
        {error.message || 'An unexpected error occurred while comparing campaigns.'}
      </Alert>
      <div>
        <Button onClick={() => reset()} variant="outline" iconLeft={RefreshCw}>
          Try again
        </Button>
      </div>
    </div>
  );
}
