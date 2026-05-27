'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-zoru-surface border rounded-lg">
      <AlertTriangle className="w-12 h-12 text-zoru-ink mb-4" />
      <h2 className="text-2xl font-bold mb-2">Something went wrong!</h2>
      <p className="text-zoru-ink-muted mb-6 max-w-md">
        We encountered an error while loading the LMS training courses. Please try again or contact support if the issue persists.
      </p>
      <Button onClick={() => reset()} variant="default">
        Try again
      </Button>
    </div>
  );
}
