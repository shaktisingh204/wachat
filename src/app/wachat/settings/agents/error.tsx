'use client';

import { useEffect } from 'react';
import { CircleAlert } from 'lucide-react';

import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

export default function ErrorBoundary({
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
    <WachatPage>
      <div className="flex h-full min-h-[400px] w-full items-center justify-center">
        <EmptyState
          icon={CircleAlert}
          tone="danger"
          title="Something went wrong!"
          description={
            error.message ||
            'An unexpected error occurred while loading agent settings.'
          }
          action={
            <Button variant="outline" onClick={() => reset()}>
              Try again
            </Button>
          }
        />
      </div>
    </WachatPage>
  );
}
