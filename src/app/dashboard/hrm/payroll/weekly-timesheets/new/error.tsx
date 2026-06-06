'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';

export default function NewTimesheetError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error fetching data for new timesheet:', error);
  }, [error]);

  return (
    <div className="p-12 text-center flex flex-col items-center gap-4">
      <h2 className="text-lg font-semibold text-[var(--st-danger)]">Something went wrong!</h2>
      <p className="text-sm text-[var(--st-text-secondary)]">
        Failed to load employees for the new timesheet form.
      </p>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
