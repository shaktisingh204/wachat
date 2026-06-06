'use client';

import * as React from 'react';
import { Button, Card } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function HrError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[HrError]', error);
  }, [error]);

  return (
    <div className="flex h-[80vh] w-full items-center justify-center p-6">
      <Card className="flex max-w-md flex-col items-center p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)] mb-4">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-[var(--st-text)]">Something went wrong</h2>
        <p className="mb-6 text-sm text-[var(--st-text-secondary)]">
          We encountered an error loading this HR page. Please try again.
        </p>
        <Button onClick={() => reset()} variant="default">
          Try again
        </Button>
      </Card>
    </div>
  );
}
