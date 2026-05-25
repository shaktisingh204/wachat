'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';

export default function EditError({
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
    <div className="flex flex-col items-center justify-center p-12 text-center text-[13px] text-zoru-danger-ink border border-zoru-danger-ink/20 bg-zoru-danger-surface rounded-lg">
      <h2 className="text-lg font-semibold mb-2">Something went wrong!</h2>
      <p className="font-medium mb-4">Failed to load timesheet data.</p>
      <Button variant="outline" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
