'use client';

import { useEffect } from 'react';
import { Card, ZoruCardContent, ZoruCardDescription, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import { Button } from '@/components/zoruui/button';

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
      <Card className="border-zoru-danger bg-zoru-surface-2/50">
        <ZoruCardHeader>
          <ZoruCardTitle className="text-zoru-danger">Connection Error</ZoruCardTitle>
          <ZoruCardDescription>
            Failed to load SabSMS dashboard data. This might be a database connectivity issue.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <div className="text-sm font-mono bg-zoru-surface-2/50 p-2 rounded text-zoru-ink">
            {error.message || 'Unknown error occurred'}
          </div>
          <Button variant="destructive" onClick={() => reset()}>
            Retry
          </Button>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
