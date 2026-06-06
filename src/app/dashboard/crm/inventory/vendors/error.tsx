'use client';

import * as React from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function VendorsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('Vendors list boundary caught error:', error);
  }, [error]);

  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-[var(--st-danger)]/10 p-4">
        <AlertCircle className="h-8 w-8 text-[var(--st-danger)]" />
      </div>
      <h2 className="text-xl font-semibold text-[var(--st-text)]">Failed to load Vendors</h2>
      <p className="max-w-md text-sm text-[var(--st-text-secondary)]">
        {error.message || 'We encountered an issue while loading vendors data.'}
      </p>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
