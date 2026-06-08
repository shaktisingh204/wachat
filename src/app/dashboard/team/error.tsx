'use client';

import { useEffect } from 'react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function TeamErrorBoundary({
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
    <div className="mx-auto flex min-h-[400px] w-full max-w-5xl items-center justify-center px-4 py-6">
      <EmptyState
        icon={<AlertTriangle />}
        tone="danger"
        title="Couldn't load this team page"
        description={
          error.message ||
          'An unexpected error occurred while loading members, roles, or invites. Try again in a moment.'
        }
        action={
          <Button variant="outline" onClick={() => reset()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
        }
      />
    </div>
  );
}
