'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('OKR Tracking Error:', error);
  }, [error]);

  return (
    <div className="flex h-[400px] flex-col items-center justify-center space-y-4 rounded-md border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950">
      <h2 className="text-xl font-semibold text-red-800 dark:text-red-200">Something went wrong fetching OKRs!</h2>
      <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
