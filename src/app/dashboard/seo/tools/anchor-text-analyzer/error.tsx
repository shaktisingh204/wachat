'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';

export default function AnchorTextAnalyzerError({
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
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center space-y-4">
      <h2 className="text-2xl font-semibold text-[var(--st-text)]">Something went wrong!</h2>
      <p className="text-[var(--st-text-secondary)]">An error occurred while running the Anchor Text Analyzer.</p>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
