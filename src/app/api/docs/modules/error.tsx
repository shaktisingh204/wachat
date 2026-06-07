'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, EmptyState, Button } from '@/components/sabcrm/20ui';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="ui20 min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] flex items-center justify-center p-6">
      <Card variant="outlined" padding="lg" className="max-w-md w-full">
        <EmptyState
          icon={AlertTriangle}
          tone="danger"
          title="Something went wrong"
          description="There was an error loading the API modules directory."
          action={
            <Button variant="primary" onClick={() => reset()} block>
              Try again
            </Button>
          }
        />
      </Card>
    </div>
  );
}
