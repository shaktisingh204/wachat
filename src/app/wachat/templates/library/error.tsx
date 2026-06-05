'use client';

import { EmptyState, Button } from '@/components/sabcrm/20ui';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

function cx(...a: Array<string | false | null | undefined>) {
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
      <div className={cx('flex', 'h-[60vh]', 'items-center', 'justify-center')}>
        <EmptyState
          icon={AlertCircle}
          tone="danger"
          title="Something went wrong"
          description={error.message || 'An unexpected error occurred while loading this module.'}
          action={<Button onClick={() => reset()}>Try again</Button>}
        />
      </div>
    </WachatPage>
  );
}
