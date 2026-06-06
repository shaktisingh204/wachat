'use client';
import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button, Card, ZoruCardContent } from '@/components/sabcrm/20ui/compat';

export default function BacklinkCheckerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
      <Card className="w-full max-w-md border-destructive/50 bg-[var(--st-text)]/10">
        <ZoruCardContent className="p-6 flex flex-col items-center text-center gap-4">
          <AlertCircle className="w-10 h-10 text-[var(--st-text)]" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold tracking-tight">Something went wrong!</h3>
            <p className="text-sm text-[var(--st-text-secondary)]">
              {error.message || "An unexpected error occurred while loading the backlink checker."}
            </p>
          </div>
          <Button onClick={() => reset()} variant="outline" className="mt-2">
            Try again
          </Button>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
