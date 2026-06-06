'use client';

import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function BomDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('BOM Detail Error Boundary caught an error:', error);
  }, [error]);

  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-[var(--st-bg-muted)] p-3 text-[var(--st-text)] dark:bg-[var(--st-text)]/20 dark:text-[var(--st-text-secondary)]">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-medium text-[var(--st-text)]">
          Could not load the BOM details
        </h2>
        <p className="text-[13px] text-[var(--st-text-secondary)]">
          There was an error retrieving this Bill of Materials. It might have been deleted, or there is a database issue.
        </p>
      </div>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
