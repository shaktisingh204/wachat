'use client';

import React, { useEffect } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="20ui flex min-h-[60vh] w-full flex-col items-center justify-center p-8">
      <EmptyState
        icon={AlertCircle}
        tone="danger"
        title="We couldn't load this page"
        description={error.message || 'The finance service did not respond. Try again in a moment.'}
        action={
          <Button variant="primary" iconLeft={RotateCcw} onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </main>
  );
}
