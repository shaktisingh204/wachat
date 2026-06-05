'use client';

import { useEffect } from 'react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { TriangleAlert } from 'lucide-react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

export default function FlowsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error in Flows:', error);
  }, [error]);

  return (
    <WachatPage>
      <div className="flex h-[50vh] flex-col items-center justify-center">
        <EmptyState
          icon={TriangleAlert}
          tone="danger"
          title="Something went wrong"
          description={error.message || "We couldn't load this page. Please try again."}
          action={
            <Button variant="outline" onClick={() => reset()}>
              Try again
            </Button>
          }
        />
      </div>
    </WachatPage>
  );
}
