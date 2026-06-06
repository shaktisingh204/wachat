'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function LeadFormsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Lead Forms Error Boundary caught:', error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] w-full flex-col items-center justify-center gap-4 rounded-xl border border-destructive/20 bg-[var(--st-text)]/5 p-8 text-center animate-in fade-in zoom-in-95 duration-200">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-text)]/20 text-[var(--st-text)]">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold tracking-tight text-[var(--st-text)]">
          Failed to load lead forms
        </h3>
        <p className="text-sm text-[var(--st-text-secondary)] max-w-[400px]">
          There was an error communicating with the Ad Manager or CRM services. Please check your page connection and try again.
        </p>
      </div>
      <Button
        variant="outline"
        onClick={() => reset()}
        className="mt-4 gap-2 hover:bg-[var(--st-text)] hover:text-white transition-colors"
      >
        <RefreshCcw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}
