'use client';

import { useEffect } from 'react';
import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Button,
} from '@/components/zoruui';
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
        <ZoruAlertTitle>Something went wrong!</ZoruAlertTitle>
        <ZoruAlertDescription className="mt-2">
          <p className="mb-4 text-sm opacity-90">
            Failed to load API keys or usage data. {error.message}
          </p>
          <Button onClick={() => reset()} variant="outline" size="sm">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </ZoruAlertDescription>
      </Alert>
    </div>
  );
}
