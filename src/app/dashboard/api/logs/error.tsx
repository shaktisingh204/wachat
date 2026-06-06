'use client';

import { useEffect } from 'react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function LogsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('API Logs load error:', error);
  }, [error]);

  return (
    <EmptyState
      icon={AlertCircle}
      tone="danger"
      title="Failed to load API Logs"
      description={error.message || 'An unexpected error occurred while fetching the logs.'}
      action={
        <Button variant="outline" iconLeft={RefreshCw} onClick={() => reset()}>
          Try again
        </Button>
      }
    />
  );
}
