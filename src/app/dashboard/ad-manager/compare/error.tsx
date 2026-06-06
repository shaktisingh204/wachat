'use client';

import * as React from 'react';
import { AmErrorAlert } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { Button } from '@/components/sabcrm/20ui/compat';

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
      <AmErrorAlert message={error.message || 'An unexpected error occurred while comparing campaigns.'} />
      <div>
        <Button onClick={() => reset()} variant="outline">
          Try again
        </Button>
      </div>
    </div>
  );
}
