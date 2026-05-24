'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';

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
    <div className="flex h-[400px] flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">Something went wrong!</h2>
      <p className="text-muted-foreground text-sm">{error.message || 'Failed to load landing pages data.'}</p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
