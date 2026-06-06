'use client';

import { Button, EmptyState } from '@/components/sabcrm/20ui/compat';
import { AlertTriangle } from 'lucide-react';
import * as React from 'react';

export default function ApiReferenceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[api-reference] route error', error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10">
      <EmptyState
        icon={<AlertTriangle />}
        title="Failed to load API Reference"
        description={
          error?.message?.length && error.message.length < 200
            ? error.message
            : 'We encountered an error loading the API reference documentation. Please try again.'
        }
        action={
          <div className="flex items-center gap-2">
            <Button size="md" onClick={() => reset()}>
              Try again
            </Button>
            <Button
              size="md"
              variant="outline"
              onClick={() => (window.location.href = '/')}
            >
              Back to home
            </Button>
          </div>
        }
      />
    </div>
  );
}
