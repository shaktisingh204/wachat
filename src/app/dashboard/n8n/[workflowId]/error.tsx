'use client';

import { Button } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function N8NWorkflowError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('N8N Workflow Error Boundary caught an error:', error);
  }, [error]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 text-center bg-[var(--gray-2)]">
      <div className="rounded-full bg-red-100 p-3 text-red-600 dark:bg-red-900/20 dark:text-red-400">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-medium text-[var(--gray-12)]">
          Could not load the workflow
        </h2>
        <p className="text-[13px] text-[var(--gray-11)]">
          There was an error retrieving this workflow. It might have been deleted, or there is a database issue.
        </p>
      </div>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
