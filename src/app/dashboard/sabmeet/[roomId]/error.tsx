'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function SabmeetRoomError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[sabmeet/room]', error);
  }, [error]);

  return (
    <main className="flex min-h-[400px] items-center justify-center p-8">
      <EmptyState
        icon={AlertCircle}
        tone="danger"
        title="This room is unavailable"
        description={
          error.message ||
          'We could not load this meeting room. It may have ended or been removed.'
        }
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => reset()}>
              Try again
            </Button>
            <Button asChild variant="primary">
              <Link href="/dashboard/meetings">Back to meetings</Link>
            </Button>
          </div>
        }
      />
    </main>
  );
}
