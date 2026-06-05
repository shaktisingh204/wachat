'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Wachat error boundary — catches unexpected React render errors and
 * displays a user-friendly recovery screen instead of the raw
 * Next.js "Internal Server Error" page.
 */

export default function WachatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[WaChat Error]', error);
  }, [error]);

  const description = error.message
    ? error.message.length > 120
      ? `${error.message.slice(0, 120)}…`
      : error.message
    : 'An unexpected error occurred loading this page.';

  return (
    <WachatPage>
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          icon={AlertCircle}
          tone="danger"
          title="Something went wrong"
          description={description}
          action={
            <div className="flex items-center justify-center gap-3">
              <Button variant="primary" size="sm" onClick={() => reset()}>
                Try again
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => (window.location.href = '/wachat')}
              >
                Back to WaChat
              </Button>
            </div>
          }
        />
      </div>
    </WachatPage>
  );
}
