'use client';

import { useEffect } from 'react';
import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/sabcrm/20ui/compat';
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
      <ZoruCard className="w-full max-w-md border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 dark:border-[var(--st-border)]/50 dark:bg-[var(--st-text)]/10">
        <ZoruCardHeader>
          <div className="flex items-center gap-2 text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
            <AlertCircle className="h-5 w-5" />
            <ZoruCardTitle>Something went wrong!</ZoruCardTitle>
          </div>
          <ZoruCardDescription className="text-[var(--st-text)]/80 dark:text-[var(--st-text-secondary)]/80">
            An error occurred while loading the production order form.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <p className="text-sm text-[var(--st-text)]/80 dark:text-[var(--st-text-secondary)]/80">
            {error.message || 'Unknown error occurred. Please try again later.'}
          </p>
        </ZoruCardContent>
        <ZoruCardFooter>
          <ZoruButton
            variant="destructive"
            onClick={reset}
            className="w-full gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Try again
          </ZoruButton>
        </ZoruCardFooter>
      </ZoruCard>
    </div>
  );
}
