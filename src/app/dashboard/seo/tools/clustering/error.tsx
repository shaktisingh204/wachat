'use client';

import { Button } from '@/components/sabcrm/20ui';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/sabcrm/20ui';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="p-6 flex items-center justify-center min-h-[400px]">
      <Card className="w-full max-w-md border-[var(--st-border)]/50">
        <CardHeader>
          <CardTitle className="text-[var(--st-text)] flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Something went wrong!
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-[var(--st-text-secondary)] break-words">
            {error.message || 'An unexpected error occurred while clustering keywords.'}
          </p>
          <Button onClick={() => reset()} variant="outline" className="w-full">
            Try again
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
