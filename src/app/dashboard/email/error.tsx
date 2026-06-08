'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function EmailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[email]', error);
  }, [error]);

  return (
    <div className="20ui flex min-h-[60vh] items-center justify-center p-6">
      <EmptyState
        tone="danger"
        icon={AlertTriangle}
        title="Couldn’t load this email page"
        description={
          error?.message
            ? `${error.message}${error.digest ? ` (ref: ${error.digest})` : ''}`
            : 'An unexpected error occurred. Try again, or contact support if it keeps happening.'
        }
        action={
          <Button onClick={() => reset()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
          </Button>
        }
      />
    </div>
  );
}
