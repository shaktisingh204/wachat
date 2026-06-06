'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button, Card, EmptyState } from '@/components/sabcrm/20ui';
import { AmBreadcrumb } from '../_components/am-page-shell';

export default function CampaignsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div>
      <AmBreadcrumb page="Campaigns" />
      <Card className="mt-5" padding="lg">
        <EmptyState
          icon={AlertCircle}
          tone="danger"
          title="Failed to load campaigns"
          description={
            <>
              We couldn&apos;t retrieve your campaigns from Meta. Please check your connection or try again.
              {error?.message ? (
                <span className="mt-2 block text-xs text-[var(--st-text-secondary)]">
                  Error details: {error.message}
                </span>
              ) : null}
            </>
          }
          action={
            <Button variant="primary" iconLeft={RefreshCw} onClick={() => reset()}>
              Try again
            </Button>
          }
        />
      </Card>
    </div>
  );
}
