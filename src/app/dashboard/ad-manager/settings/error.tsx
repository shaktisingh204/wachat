'use client';

import * as React from 'react';
import { AmErrorAlert } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { ZoruButton } from '@/components/sabcrm/20ui/compat';

export default function AdManagerSettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[AdManager Settings ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <AmErrorAlert message={error.message || 'An unexpected error occurred in Ad Manager Settings.'} />
      <div>
        <ZoruButton onClick={() => reset()} variant="outline">
          Try again
        </ZoruButton>
      </div>
    </div>
  );
}
