'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function EmbedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('[EmbedError]', error);
  }, [error]);

  return (
    <main className="20ui m-0 flex h-screen items-center justify-center bg-[var(--st-bg)] p-6 text-[var(--st-text)]">
      <EmptyState
        icon={AlertTriangle}
        tone="danger"
        title="Unable to load chat"
        description={
          error.message || 'An unexpected error occurred while loading this widget.'
        }
        action={
          <Button variant="primary" iconLeft={RotateCcw} onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </main>
  );
}
