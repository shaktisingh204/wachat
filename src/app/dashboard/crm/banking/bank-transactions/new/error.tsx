'use client';

import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function NewBankTransactionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('New Bank Transaction Error Boundary caught an error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6">
      <EmptyState
        icon={<AlertCircle />}
        title="Something went wrong loading payment accounts"
        description={
          error?.message?.length && error.message.length < 200
            ? error.message
            : 'There was an error communicating with the server. Please try again.'
        }
        action={
          <Button onClick={() => reset()} variant="outline">
            Try again
          </Button>
        }
      />
    </div>
  );
}
