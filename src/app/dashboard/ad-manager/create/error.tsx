'use client';

import * as React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function CreateAdManagerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[CreateAdManager ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="p-6">
      <EmptyState
        icon={AlertTriangle}
        tone="danger"
        title="Something went wrong"
        description={error.message || 'An unexpected error occurred while creating an ad.'}
        action={
          <Button variant="outline" iconLeft={RotateCcw} onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
