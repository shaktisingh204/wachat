'use client';

import * as React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/zoruui';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log the error to an error reporting service
    console.error('Permission Group ID Error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 text-center bg-zoru-surface rounded-lg border border-zoru-danger-ink/20">
      <ShieldAlert className="h-12 w-12 text-zoru-danger-ink" />
      <h2 className="text-xl font-bold text-zoru-ink">Failed to load permission group</h2>
      <p className="text-sm text-zoru-ink-muted max-w-md">
        {error.message || 'There was an error while loading the group details.'}
      </p>
      <Button onClick={() => reset()} variant="default">
        Try again
      </Button>
    </div>
  );
}
