'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';

export default function AutomateError({
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
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-medium text-zoru-ink">Failed to load Automate Shift data</h2>
      <p className="text-sm text-zoru-ink-muted">{error.message}</p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
