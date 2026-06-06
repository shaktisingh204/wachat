'use client';

import { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle, Button } from '@/components/sabcrm/20ui';
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
      <Alert variant="destructive" className="max-w-md">
        <AlertCircle className="h-5 w-5" />
        <AlertTitle>Something went wrong!</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-4 text-sm opacity-90">
            Failed to load API keys or usage data. {error.message}
          </p>
          <Button onClick={() => reset()} variant="outline" size="sm">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
