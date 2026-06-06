'use client';

import { useEffect } from 'react';
import { Alert, AlertTitle, AlertDescription, Button } from '@/components/sabcrm/20ui';

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
      <Alert tone="danger">
        <AlertTitle>Error loading catalogs</AlertTitle>
        <AlertDescription>
          <p className="mb-4 text-[var(--st-text-secondary)]">
            {error.message || 'An unexpected error occurred while loading catalogs.'}
          </p>
          <Button variant="outline" onClick={() => reset()}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
