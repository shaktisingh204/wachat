'use client';

import * as React from 'react';
import { ZoruAlert, ZoruAlertTitle, ZoruAlertDescription, ZoruButton } from '@/components/zoruui';
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
      <ZoruAlert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <ZoruAlertTitle>Failed to load product</ZoruAlertTitle>
        <ZoruAlertDescription>
          {error.message || 'An unexpected error occurred while loading this product.'}
        </ZoruAlertDescription>
      </ZoruAlert>
      <div className="flex gap-4">
        <ZoruButton onClick={() => reset()}>Try again</ZoruButton>
        <ZoruButton variant="outline" onClick={() => router.push('/dashboard/crm/products')}>
          Back to Products
        </ZoruButton>
      </div>
    </div>
  );
}
