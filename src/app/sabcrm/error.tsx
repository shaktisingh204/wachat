'use client';

/**
 * SabCRM root error boundary (`/sabcrm/*`), 20ui.
 *
 * Catches runtime errors anywhere under the SabCRM segment that a more
 * specific boundary didn't handle. Renders inside `layout.tsx`'s
 * `SabcrmSuiteFrame` (which carries the 20ui token scope), so this is pure
 * 20ui — no `.sabcrm-twenty` / `.st-*` classes.
 */

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function SabcrmError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('SabCRM Error:', error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8" role="alert">
      <EmptyState
        icon={AlertTriangle}
        tone="danger"
        title="Something went wrong in SabCRM"
        description={
          error?.message ||
          'An unexpected error occurred while loading SabCRM. Please try again or contact support if the issue persists.'
        }
        action={
          <Button variant="primary" onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </main>
  );
}
