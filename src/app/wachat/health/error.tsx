'use client';

import { useEffect } from 'react';
import { Button, EmptyState } from '@/components/zoruui';
import { TriangleAlert } from 'lucide-react';

export default function HealthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error in Health:', error);
  }, [error]);

  return (
    <div className="flex h-[50vh] flex-col items-center justify-center">
      <EmptyState
        icon={<TriangleAlert className="h-10 w-10 text-zoru-danger" />}
        title="Something went wrong"
        description="We couldn't load this page. Please try again."
        action={
          <Button onClick={reset} variant="outline" className="mt-4">
            Try again
          </Button>
        }
      />
    </div>
  );
}