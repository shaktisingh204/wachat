'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

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
      <div className={cx('flex flex-col items-center justify-center min-h-[400px]')}>
        <EmptyState
          icon={AlertCircle}
          tone="danger"
          title="Something went wrong!"
          description={
            error.message ||
            'An unexpected error occurred while loading this page.'
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
