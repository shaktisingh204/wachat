'use client';

/**
 * Error boundary for the SabCRM object index page (`/sabcrm/[objectSlug]`).
 *
 * Catches runtime errors during object page rendering, including:
 *   - Unexpected failures in record loading / filtering / sorting
 *   - Malformed object metadata
 *   - Unhandled exceptions in the interactive toolbar / table / board views
 *
 * The layout already enforces auth / RBAC guard, so this boundary is
 * a safety net for component-level failures only.
 */

import * as React from 'react';
import Link from 'next/link';
import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { AlertTriangle } from 'lucide-react';

export default function SabcrmObjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[sabcrm-object] route error', error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <EmptyState
        icon={AlertTriangle}
        tone="danger"
        title="Something went wrong"
        description={
          error?.message?.length && error.message.length < 200
            ? error.message
            : 'The CRM object page hit an unexpected error. Try again or head back to overview.'
        }
        action={
          <div className="flex items-center gap-2">
            <Button size="md" variant="primary" onClick={() => reset()}>
              Try again
            </Button>
            <Link href="/sabcrm">
              <Button size="md" variant="outline">
                Back to CRM
              </Button>
            </Link>
          </div>
        }
      />
    </main>
  );
}
