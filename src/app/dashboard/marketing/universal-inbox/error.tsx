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
    <div className="flex items-center justify-center h-[calc(100vh-8rem)] w-full rounded-xl border border-red-200 bg-red-50/50">
      <div className="flex flex-col items-center space-y-4 max-w-md text-center p-6">
        <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="h-6 w-6 text-red-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-red-900">Something went wrong!</h2>
          <p className="text-sm text-red-600">Failed to load Universal Inbox data. Please try again.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => reset()}
          className="border-red-200 text-red-700 hover:bg-red-100"
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
