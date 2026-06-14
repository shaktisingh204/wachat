'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function SabvoiceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[sabcall]', error);
  }, [error]);

  return (
    <main className="20ui flex min-h-[400px] items-center justify-center p-8">
      <EmptyState
        icon={AlertCircle}
        tone="danger"
        title="Something went wrong"
        description={error.message || 'We could not load this SabCall page. Please try again.'}
        action={
          <Button variant="outline" onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </main>
  );
}
