'use client';

import { Alert, AlertDescription, AlertTitle, Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle, RotateCcw } from 'lucide-react';
import * as React from 'react';

export default function CustomerListsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log the error to an error reporting service
    console.error('Customer Lists Error:', error);
  }, [error]);

  return (
    <div className="p-6">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Something went wrong!</AlertTitle>
        <AlertDescription>
          {error.message || 'An unexpected error occurred in the customer lists module.'}
        </AlertDescription>
      </Alert>
      <div className="mt-4">
        <Button onClick={() => reset()} variant="outline">
          <RotateCcw className="h-4 w-4 mr-2" /> Try again
        </Button>
      </div>
    </div>
  );
}
