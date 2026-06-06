'use client';

import { useEffect } from 'react';
import { Alert, Button } from '@/components/sabcrm/20ui';
import { AlertCircle, RefreshCcw } from 'lucide-react';

export default function ApiKeysError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('API Keys Error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <Alert
        tone="danger"
        icon={AlertCircle}
        title="Something went wrong"
        className="max-w-md"
      >
        <p className="mb-4 text-sm text-[var(--st-text-secondary)]">
          Failed to load API keys or usage data. {error.message}
        </p>
        <Button onClick={() => reset()} variant="outline" size="sm" iconLeft={RefreshCcw}>
          Try again
        </Button>
      </Alert>
    </div>
  );
}
