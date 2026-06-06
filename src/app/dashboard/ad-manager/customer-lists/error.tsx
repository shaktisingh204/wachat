'use client';

import { Alert, Button } from '@/components/sabcrm/20ui';
import { RotateCcw } from 'lucide-react';
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
      <Alert tone="danger" title="Something went wrong">
        {error.message || 'An unexpected error occurred in the customer lists module.'}
      </Alert>
      <div className="mt-4">
        <Button variant="outline" iconLeft={RotateCcw} onClick={() => reset()}>
          Try again
        </Button>
      </div>
    </div>
  );
}
