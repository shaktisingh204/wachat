'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';
import { AlertCircle } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/sabcrm/20ui';

export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Checkout error:', error);
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-24 flex justify-center items-center">
      <Card className="max-w-md w-full border-destructive">
        <CardHeader>
          <div className="flex items-center gap-2 text-[var(--st-text)]">
            <AlertCircle className="h-5 w-5" />
            <CardTitle>Something went wrong!</CardTitle>
          </div>
          <CardDescription>
            We encountered an error while loading the checkout process.
          </CardDescription>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <p className="text-sm text-[var(--st-text-secondary)]">
            {error.message || 'An unexpected error occurred.'}
          </p>
          <Button onClick={() => reset()} variant="default">
            Try again
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
