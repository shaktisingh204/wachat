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
} from '@/components/zoruui';
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
      <ZoruCard className="w-full max-w-md border-zoru-line bg-zoru-surface-2/50 dark:border-zoru-line/50 dark:bg-zoru-ink/10">
        <ZoruCardHeader>
          <div className="flex items-center gap-2 text-zoru-ink dark:text-zoru-ink-muted">
            <AlertCircle className="h-5 w-5" />
            <ZoruCardTitle>Something went wrong!</ZoruCardTitle>
          </div>
          <ZoruCardDescription className="text-zoru-ink/80 dark:text-zoru-ink-muted/80">
            An error occurred while loading the production order form.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <p className="text-sm text-zoru-ink/80 dark:text-zoru-ink-muted/80">
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
