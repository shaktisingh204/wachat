'use client';

import * as React from 'react';
import { Alert, AlertTitle, AlertDescription, Button } from '@/components/sabcrm/20ui';
import { AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load product</AlertTitle>
        <AlertDescription>
          {error.message || 'An unexpected error occurred while loading this product.'}
        </AlertDescription>
      </Alert>
      <div className="flex gap-4">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" onClick={() => router.push('/dashboard/crm/products')}>
          Back to Products
        </Button>
      </div>
    </div>
  );
}
