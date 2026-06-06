'use client';

import { useEffect } from 'react';
import { Button, Alert, Card, ZoruCardContent as CardContent } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

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
    <div className="p-6">
      <Card>
        <CardContent className="p-6 flex flex-col items-center justify-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-zoru-ink" />
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Something went wrong!</h2>
            <p className="text-sm text-zoru-ink-muted">
              {error.message || 'An unexpected error occurred while loading the CSS minifier.'}
            </p>
          </div>
          <Button onClick={() => reset()}>Try again</Button>
        </CardContent>
      </Card>
    </div>
  );
}
