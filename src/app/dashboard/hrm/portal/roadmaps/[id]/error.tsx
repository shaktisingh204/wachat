'use client';

import { useEffect } from 'react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { AlertCircle } from 'lucide-react';

export default function RoadmapError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Roadmap view error:', error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <EmptyState
        icon={AlertCircle}
        title="Failed to load roadmap"
        description="There was an error while retrieving the roadmap data. Please try again."
        action={
          <Button onClick={reset} variant="default">
            Try Again
          </Button>
        }
      />
    </div>
  );
}
