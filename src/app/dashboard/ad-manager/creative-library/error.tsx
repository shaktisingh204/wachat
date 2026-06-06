'use client';

import * as React from 'react';
import { RotateCcw } from 'lucide-react';

import { AmErrorAlert } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { Button } from '@/components/sabcrm/20ui';

export default function CreativeLibraryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[CreativeLibrary ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <AmErrorAlert
        message={error.message || 'An unexpected error occurred in the Creative Library.'}
      />
      <div>
        <Button variant="outline" iconLeft={RotateCcw} onClick={() => reset()}>
          Try again
        </Button>
      </div>
    </div>
  );
}
