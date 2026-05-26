'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-[400px] w-full flex-col items-center justify-center space-y-4 rounded-[var(--zoru-radius)] border border-dashed border-red-500 bg-red-50/50 p-8 text-center dark:bg-red-950/10">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
        <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
          Something went wrong!
        </h2>
        <p className="text-sm text-red-600 dark:text-red-400 max-w-md mx-auto">
          {error.message || 'An unexpected error occurred while loading this page.'}
        </p>
      </div>
      <Button onClick={reset} variant="outline" className="mt-4">
        Try again
      </Button>
    </div>
  );
}
