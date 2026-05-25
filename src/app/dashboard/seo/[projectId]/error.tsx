'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';

export default function SeoProjectError({
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
    <div className="flex h-[400px] flex-col items-center justify-center gap-4 rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface/50 p-8 text-center">
      <div className="rounded-full bg-zoru-danger/10 p-3">
        <AlertCircle className="h-8 w-8 text-zoru-danger-ink" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-zoru-ink">Something went wrong!</h2>
        <p className="mt-2 text-sm text-zoru-ink-muted">
          {error.message || 'An error occurred while loading this page.'}
        </p>
      </div>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
