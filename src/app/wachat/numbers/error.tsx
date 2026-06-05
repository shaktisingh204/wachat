'use client';

import { EmptyState, Button } from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

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
      <div className="flex h-[60vh] items-center justify-center">
        <EmptyState
          icon={AlertCircle}
          title="Something went wrong"
          description={error.message || 'An unexpected error occurred while loading this module.'}
          action={<Button onClick={() => reset()}>Try again</Button>}
        />
      </div>
    </WachatPage>
  );
}
