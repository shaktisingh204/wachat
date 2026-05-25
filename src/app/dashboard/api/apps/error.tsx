'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function AppsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Apps load error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-zoru-line border-dashed bg-zoru-surface/50">
      <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
        <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
      </div>
      <h2 className="text-lg font-semibold text-zoru-ink mb-2">Failed to load OAuth Apps</h2>
      <p className="text-sm text-zoru-ink-subtle mb-6 max-w-md">
        {error.message || 'An unexpected error occurred while fetching your applications.'}
      </p>
      <Button onClick={() => reset()} variant="outline" className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}
