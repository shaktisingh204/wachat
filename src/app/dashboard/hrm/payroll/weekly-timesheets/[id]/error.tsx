'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';

export default function WeeklyTimesheetError({
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
    <div className="flex h-full flex-col items-center justify-center p-12">
      <h2 className="mb-4 text-lg font-semibold text-zoru-ink">Something went wrong!</h2>
      <p className="mb-6 text-sm text-zoru-ink-muted">{error.message}</p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
