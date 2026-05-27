'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';

export default function Error({
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
    <div className="flex items-center justify-center h-[calc(100vh-8rem)] w-full rounded-xl border border-zoru-line bg-zoru-surface-2/50">
      <div className="flex flex-col items-center space-y-4 max-w-md text-center p-6">
        <div className="h-12 w-12 rounded-full bg-zoru-surface-2 flex items-center justify-center">
          <AlertCircle className="h-6 w-6 text-zoru-ink" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-zoru-ink">Something went wrong!</h2>
          <p className="text-sm text-zoru-ink">Failed to load Universal Inbox data. Please try again.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => reset()}
          className="border-zoru-line text-zoru-ink hover:bg-zoru-surface-2"
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
