'use client';

import { Card, CardBody, Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

export default function SeoToolsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('SEO Tools Error:', error);
  }, [error]);

  return (
    <div className="flex h-[50vh] items-center justify-center p-4">
      <Card className="max-w-md w-full border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 dark:border-[var(--st-border)]/30 dark:bg-[var(--st-text)]/20">
        <CardBody className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="rounded-full bg-[var(--st-bg-muted)] p-3 dark:bg-[var(--st-text)]/50">
            <AlertCircle className="h-6 w-6 text-[var(--st-text)] dark:text-[var(--st-text-secondary)]" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
              Something went wrong
            </h2>
            <p className="text-sm text-[var(--st-text)]/80 dark:text-[var(--st-text-secondary)]/80">
              {error.message || 'An unexpected error occurred while loading this tool.'}
            </p>
          </div>
          <Button 
            variant="outline" 
            className="mt-2 border-[var(--st-border)] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)] dark:border-[var(--st-border)] dark:text-[var(--st-text-secondary)] dark:hover:bg-[var(--st-text)]/50"
            onClick={reset}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
