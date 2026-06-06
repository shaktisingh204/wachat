'use client';

import * as React from 'react';
import { AmErrorAlert, AmBreadcrumb } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { Button } from '@/components/sabcrm/20ui';

export default function PixelsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('Pixels error:', error);
  }, [error]);

  return (
    <div className="space-y-6">
      <AmBreadcrumb page="Pixels & datasets" />
      <AmErrorAlert 
        title="Something went wrong!"
        message={error.message || "Failed to load pixels data. Please try again."}
        action={
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
