'use client';

import { Button } from '@/components/zoruui';
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
      <div className="rounded-full bg-red-100 p-3 text-red-600 dark:bg-red-900/20 dark:text-red-400">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-medium text-zoru-ink">
          Could not load the BOM details
        </h2>
        <p className="text-[13px] text-zoru-ink-muted">
          There was an error retrieving this Bill of Materials. It might have been deleted, or there is a database issue.
        </p>
      </div>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
