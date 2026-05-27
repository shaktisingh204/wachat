'use client';

import { useEffect } from 'react';
import { Button, Card, ZoruCardContent } from '@/components/zoruui';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Connections page error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="max-w-md w-full border-destructive/50">
        <ZoruCardContent className="pt-6 flex flex-col items-center text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-zoru-ink/10 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-zoru-ink" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">Failed to load connections</h2>
            <p className="text-sm text-zoru-ink-muted">
              {error.message || 'An unexpected error occurred while loading your Instagram accounts.'}
            </p>
          </div>
          <Button onClick={() => reset()} className="mt-4" variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
