'use client';

import { EmptyState, Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function ErrorBoundary({
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
    <div className="flex h-[80vh] items-center justify-center p-6">
      <EmptyState
        icon={<AlertCircle className="h-10 w-10 text-[var(--st-danger)]" />}
        title="Something went wrong"
        description={error.message || 'An unexpected error occurred while loading this module.'}
        action={<Button onClick={() => reset()}>Try again</Button>}
      />
    </div>
  );
}
