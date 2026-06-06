'use client';

import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { AlertTriangle } from 'lucide-react';
import * as React from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[personal-tokens] route error', error);
  }, [error]);

  return (
    <div className="flex h-[50vh] items-center justify-center">
      <EmptyState
        icon={<AlertTriangle className="h-8 w-8 text-[var(--st-danger)]" />}
        title="Something went wrong"
        description={
          error?.message?.length && error.message.length < 200
            ? error.message
            : 'We encountered an error loading your personal tokens.'
        }
        action={
          <Button size="md" onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
