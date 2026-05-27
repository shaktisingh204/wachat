'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function CacheCheckerError({
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
    <ToolShell title="Cache Checker" description="Check if URLs are cached by Google and the Wayback Machine.">
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg border-destructive/20 bg-zoru-ink/10">
        <h2 className="mb-2 text-lg font-semibold text-zoru-ink">Something went wrong!</h2>
        <p className="mb-4 text-sm text-zoru-ink-muted">
          {error.message || 'An unexpected error occurred while loading the cache checker.'}
        </p>
        <Button variant="outline" onClick={() => reset()}>
          Try again
        </Button>
      </div>
    </ToolShell>
  );
}
