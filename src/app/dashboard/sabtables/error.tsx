'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';

import { Button, Card, EmptyState } from '@/components/sabcrm/20ui';

export default function SabtablesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[sabtables] route error', error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Card variant="outlined">
        <EmptyState
          icon={AlertTriangle}
          title="Something went wrong"
          description="We couldn't load this part of SabTables. Try again, or head back to your workspaces."
          action={
            <div className="flex items-center gap-2">
              <Button variant="primary" iconLeft={RotateCcw} onClick={() => reset()}>
                Try again
              </Button>
              <Button asChild variant="ghost">
                <Link href="/dashboard/sabtables">All workspaces</Link>
              </Button>
            </div>
          }
        />
      </Card>
    </main>
  );
}
