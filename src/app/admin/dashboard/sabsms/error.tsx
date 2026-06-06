'use client';

import { useEffect } from 'react';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
import { Button } from '@/components/sabcrm/20ui';

export default function SabsmsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('SabSMS Dashboard Error:', error);
  }, [error]);

  return (
    <div className="space-y-6">
      <Card className="border-[var(--st-danger)] bg-[var(--st-bg-muted)]/50">
        <CardHeader>
          <CardTitle className="text-[var(--st-danger)]">Connection Error</CardTitle>
          <CardDescription>
            Failed to load SabSMS dashboard data. This might be a database connectivity issue.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="text-sm font-mono bg-[var(--st-bg-muted)]/50 p-2 rounded text-[var(--st-text)]">
            {error.message || 'Unknown error occurred'}
          </div>
          <Button variant="destructive" onClick={() => reset()}>
            Retry
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
