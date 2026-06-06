'use client';

import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('BOM New Error:', error);
  }, [error]);

  return (
    <div className="flex h-[50vh] w-full items-center justify-center p-6">
      <Card className="max-w-md w-full border-zoru-danger-border shadow-sm">
        <ZoruCardHeader className="flex flex-row items-center gap-3 space-y-0">
          <div className="rounded-full bg-[var(--st-danger-soft)] p-2 text-[var(--st-danger)]">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <ZoruCardTitle className="text-lg text-[var(--st-danger)]">Failed to load BOM form</ZoruCardTitle>
          </div>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <p className="text-sm text-[var(--st-text-secondary)]">
            {error.message || 'An unexpected error occurred while preparing the BOM creation form.'}
          </p>
          <Button 
            onClick={reset}
            variant="outline"
            className="w-full gap-2 border-zoru-danger-border text-[var(--st-danger)] hover:bg-[var(--st-danger-soft)] hover:text-[var(--st-danger)]"
          >
            <RefreshCcw className="h-4 w-4" />
            Try again
          </Button>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
