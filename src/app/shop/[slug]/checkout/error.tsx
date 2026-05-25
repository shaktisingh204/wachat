'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui/button';
import { AlertCircle } from 'lucide-react';
import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription } from '@/components/zoruui/card';

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
        <ZoruCardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <ZoruCardTitle>Something went wrong!</ZoruCardTitle>
          </div>
          <ZoruCardDescription>
            We encountered an error while loading the checkout process.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {error.message || 'An unexpected error occurred.'}
          </p>
          <Button onClick={() => reset()} variant="default">
            Try again
          </Button>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
