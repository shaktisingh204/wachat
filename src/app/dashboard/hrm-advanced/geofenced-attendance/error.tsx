'use client';

import { useEffect } from 'react';
import { Button, EmptyState } from '@/components/sabcrm/20ui/compat';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Attendance error:', error);
  }, [error]);

  return (
    <div className="p-6">
      <EmptyState
        title="Failed to load attendance records"
        description={error.message || "There was an error fetching the attendance data. Please try again later."}
        action={<Button onClick={() => reset()}>Try again</Button>}
      />
    </div>
  );
}
