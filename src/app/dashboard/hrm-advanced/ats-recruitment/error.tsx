'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/zoruui';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('ATS Recruitment Page Error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 space-y-4">
      <Alert variant="destructive" className="max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Something went wrong!</AlertTitle>
        <AlertDescription>
          {error.message || "An unexpected error occurred while loading the ATS data."}
        </AlertDescription>
      </Alert>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
