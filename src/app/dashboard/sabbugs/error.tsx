'use client';

/**
 * Error boundary for the bug-tracker module (`/dashboard/sabbugs/*`).
 *
 * Catches render/data failures in any segment and offers a retry without a
 * full page reload.
 */
import * as React from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function SabBugsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[sabbugs] route error', error);
  }, [error]);

  return (
    <div className="20ui flex w-full items-center justify-center p-6">
      <EmptyState
        icon={AlertTriangle}
        tone="danger"
        title="Something went wrong"
        description="We couldn't load this part of the bug tracker. Try again, or come back in a moment."
        action={
          <Button variant="primary" onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
