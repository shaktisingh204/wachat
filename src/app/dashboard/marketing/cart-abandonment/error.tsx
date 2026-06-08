'use client';

import * as React from 'react';
import { TriangleAlert, RotateCcw } from 'lucide-react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function CartAbandonmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[marketing] cart-abandonment route error', error);
  }, [error]);

  return (
    <div className="20ui mx-auto w-full max-w-[1180px] px-6 py-6">
      <div role="alert" className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          icon={TriangleAlert}
          tone="danger"
          title="Couldn't load cart data"
          description={error.message || 'We ran into an issue loading abandoned carts. Try again.'}
          action={
            <Button variant="primary" iconLeft={RotateCcw} onClick={() => reset()}>
              Try again
            </Button>
          }
        />
      </div>
    </div>
  );
}
