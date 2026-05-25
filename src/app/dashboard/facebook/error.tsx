'use client';

import React from 'react';
import { Button } from '@/components/zoruui';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center space-y-4 p-8">
      <div className="text-center">
        <h2 className="text-xl font-bold">Something went wrong!</h2>
        <p className="text-muted-foreground mt-2">{error.message || 'An unexpected error occurred.'}</p>
      </div>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
