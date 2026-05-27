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
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 dark:bg-zoru-ink/20">
        <AlertTriangle className="h-6 w-6 text-zoru-ink dark:text-zoru-ink-muted" />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Something went wrong!</h2>
        <p className="text-sm text-zoru-ink-muted max-w-[500px]">
          There was an error loading the reports module. {error.message}
        </p>
      </div>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
