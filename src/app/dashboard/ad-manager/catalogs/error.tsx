'use client';

import { useEffect } from 'react';
import { AlertDescription, AlertTitle, Alert, Button } from '@/components/sabcrm/20ui';
import { AlertCircle } from 'lucide-react';

export default function CatalogsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="p-6">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Catalogs</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-4">
            {error.message || 'An unexpected error occurred while loading catalogs.'}
          </p>
          <Button onClick={() => reset()} variant="outline">
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
