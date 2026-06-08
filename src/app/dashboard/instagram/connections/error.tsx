'use client';

import { useEffect } from 'react';
import { Button, Card, EmptyState } from '@/components/sabcrm/20ui';
import { RefreshCw, TriangleAlert } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Connections page error:', error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Card variant="outlined">
        <EmptyState
          icon={TriangleAlert}
          tone="danger"
          title="Failed to load connections"
          description={
            error.message ||
            'Something went wrong while loading your Instagram accounts. Try again in a moment.'
          }
          action={
            <Button variant="outline" iconLeft={RefreshCw} onClick={() => reset()}>
              Try again
            </Button>
          }
        />
      </Card>
    </div>
  );
}
