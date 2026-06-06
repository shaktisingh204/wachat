'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';
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
    <div className="flex h-[400px] flex-col items-center justify-center gap-4 rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)]/50 p-8 text-center">
      <div className="rounded-full bg-[var(--st-danger)]/10 p-3">
        <AlertCircle className="h-8 w-8 text-[var(--st-danger)]" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-[var(--st-text)]">Something went wrong!</h2>
        <p className="mt-2 text-sm text-[var(--st-text-secondary)]">
          {error.message || 'An error occurred while loading this page.'}
        </p>
      </div>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
