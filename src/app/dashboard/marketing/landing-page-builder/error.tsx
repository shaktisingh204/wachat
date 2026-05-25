'use client';

import React, { useEffect } from 'react';
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
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-[400px] w-full flex-col items-center justify-center space-y-4 rounded-lg border border-dashed border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950/10">
      <AlertCircle className="h-10 w-10 text-red-500" />
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">
          Something went wrong loading campaigns!
        </h2>
        <p className="text-sm text-red-600 dark:text-red-500">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
      </div>
      <Button 
        onClick={() => reset()}
        variant="outline"
        className="mt-4 border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
      >
        Try again
      </Button>
    </div>
  );
}
