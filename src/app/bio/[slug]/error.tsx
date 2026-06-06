"use client";

import { useEffect } from "react";
import { Button } from '@/components/sabcrm/20ui';
import { AlertCircle } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Bio page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--st-text)] px-4">
      <div className="flex flex-col items-center gap-4 text-center max-w-md p-8 rounded-2xl bg-[var(--st-text)]/50 border border-[var(--st-border)]/20">
        <div className="h-12 w-12 rounded-full bg-[var(--st-text)]/10 flex items-center justify-center text-[var(--st-text)]">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Something went wrong!</h2>
          <p className="mt-2 text-sm text-[var(--st-text-secondary)]">
            We couldn't load this profile. Please try again later.
          </p>
        </div>
        <Button onClick={() => reset()} variant="outline" className="mt-4">
          Try again
        </Button>
      </div>
    </div>
  );
}
