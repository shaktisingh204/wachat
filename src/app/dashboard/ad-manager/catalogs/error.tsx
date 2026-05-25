'use client';

import { useEffect } from 'react';
import { ZoruAlertDescription, ZoruAlertTitle, Alert, Button } from '@/components/zoruui';
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
        <ZoruAlertTitle>Error Loading Catalogs</ZoruAlertTitle>
        <ZoruAlertDescription className="mt-2">
          <p className="mb-4">
            {error.message || 'An unexpected error occurred while loading catalogs.'}
          </p>
          <Button onClick={() => reset()} variant="outline">
            Try again
          </Button>
        </ZoruAlertDescription>
      </Alert>
    </div>
  );
}
