'use client';

import React, { useEffect } from 'react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default function Error({
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
    <div className="flex items-center justify-center h-[calc(100vh-8rem)] w-full">
      <EmptyState
        icon={AlertCircle}
        tone="danger"
        title="Something went wrong"
        description="Failed to load Universal Inbox data. Please try again."
        action={
          <Button variant="outline" iconLeft={RotateCcw} onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
