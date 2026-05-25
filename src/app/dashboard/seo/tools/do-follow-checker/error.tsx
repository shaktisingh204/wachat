'use client';

import { useEffect } from 'react';
import { Button, Card, ZoruCardContent } from '@/components/zoruui';
import { AlertTriangle } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-[50vh] w-full items-center justify-center p-4">
      <Card className="max-w-md border-red-500/50">
        <ZoruCardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="rounded-full bg-red-100 p-3 text-red-500 dark:bg-red-500/20">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold tracking-tight">Something went wrong!</h3>
            <p className="text-sm text-zoru-text-muted">
              An error occurred while loading the DoFollow Checker tool. We've been notified and are looking into it.
            </p>
          </div>
          <Button onClick={() => reset()} variant="outline" className="mt-2">
            Try again
          </Button>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
