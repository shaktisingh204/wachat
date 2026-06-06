'use client';

import { useEffect } from 'react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { AlertTriangle } from 'lucide-react';

export default function ReportsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Reports Error:', error);
  }, [error]);

  return (
    <div className="ui20 flex min-h-[400px] w-full items-center justify-center p-8">
      <EmptyState
        icon={AlertTriangle}
        tone="danger"
        title="Something went wrong!"
        description={`There was an error loading the reports module. ${error.message}`}
        action={
          <Button variant="outline" onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
