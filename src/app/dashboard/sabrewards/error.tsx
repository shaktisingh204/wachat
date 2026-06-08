'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button, Card, CardBody, EmptyState } from '@/components/sabcrm/20ui';

export default function RewardsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    console.error('Rewards module error', error);
  }, [error]);

  return (
    <div className="20ui p-4 md:p-6">
      <Card>
        <CardBody>
          <EmptyState
            icon={AlertTriangle}
            title="Something went wrong"
            description="We couldn't load this rewards view. Try again, or refresh the page."
            action={
              <Button variant="primary" onClick={reset}>
                Try again
              </Button>
            }
          />
        </CardBody>
      </Card>
    </div>
  );
}
