'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function DomainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[Domain ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="20ui min-h-screen flex items-center justify-center p-6 bg-[var(--st-bg)] text-[var(--st-text)]">
      <EmptyState
        icon={AlertTriangle}
        tone="danger"
        title="Something went wrong"
        description={
          error.message || 'An unexpected error occurred while loading this domain.'
        }
        action={
          <Button onClick={() => reset()} variant="outline">
            Try again
          </Button>
        }
      />
    </div>
  );
}
