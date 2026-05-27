'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';

export default function ShiftDetailError({
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
    <div className="flex h-[50vh] flex-col items-center justify-center gap-4 p-6">
      <AlertCircle className="h-10 w-10 text-zoru-ink" />
      <h2 className="text-lg font-semibold text-zoru-ink">Something went wrong!</h2>
      <p className="text-sm text-zoru-ink-muted">
        {error.message || "Failed to load the shift details."}
      </p>
      <Button onClick={reset} variant="secondary">
        Try again
      </Button>
    </div>
  );
}
