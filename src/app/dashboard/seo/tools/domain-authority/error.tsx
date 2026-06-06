'use client';

import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-[var(--st-text)]/10 rounded-lg border border-destructive/20 mt-6">
      <AlertCircle className="w-10 h-10 text-[var(--st-text)] mb-4" />
      <h2 className="text-xl font-semibold mb-2">Something went wrong!</h2>
      <p className="text-sm text-[var(--st-text-secondary)] mb-4">
        {error.message || 'An unexpected error occurred while checking domain authority.'}
      </p>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
