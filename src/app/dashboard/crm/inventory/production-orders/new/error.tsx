'use client';

import { useEffect } from 'react';
import { Button, Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
import { AlertCircle, RefreshCcw } from 'lucide-react';

export default function NewProductionOrderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('New Production Order Error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <Card className="w-full max-w-md border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 dark:border-[var(--st-border)]/50 dark:bg-[var(--st-text)]/10">
        <CardHeader>
          <div className="flex items-center gap-2 text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
            <AlertCircle className="h-5 w-5" />
            <CardTitle>Something went wrong!</CardTitle>
          </div>
          <CardDescription className="text-[var(--st-text)]/80 dark:text-[var(--st-text-secondary)]/80">
            An error occurred while loading the production order form.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-[var(--st-text)]/80 dark:text-[var(--st-text-secondary)]/80">
            {error.message || 'Unknown error occurred. Please try again later.'}
          </p>
        </CardBody>
        <CardFooter>
          <Button
            variant="destructive"
            onClick={reset}
            className="w-full gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Try again
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
