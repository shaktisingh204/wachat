'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';
import { AlertTriangle } from 'lucide-react';

export default function ReportsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Reports Error:', error);
  }, [error]);

  return (
    <div className="flex h-[400px] w-full flex-col items-center justify-center space-y-4 rounded-xl border border-dashed p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
        <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Something went wrong!</h2>
        <p className="text-sm text-muted-foreground max-w-[500px]">
          There was an error loading the reports module. {error.message}
        </p>
      </div>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
