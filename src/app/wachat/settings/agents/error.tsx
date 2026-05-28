'use client';

import { useEffect } from 'react';
import { Button, EmptyState } from '@/components/zoruui';
import { CircleAlert } from 'lucide-react';

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
    <div className="flex h-full min-h-[400px] w-full items-center justify-center">
      <EmptyState
        icon={<CircleAlert className="h-10 w-10 text-zoru-ink" />}
        title="Something went wrong!"
        description={error.message || "An unexpected error occurred while loading agent settings."}
        action={
          <Button onClick={() => reset()} variant="outline">
            Try again
          </Button>
        }
      />
    </div>
  );
}
