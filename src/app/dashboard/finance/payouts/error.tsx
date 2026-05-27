"use client";

import { useEffect } from "react";
import { Button } from '@/components/zoruui';

export default function PayoutsError({
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
    <div className="flex h-full flex-col items-center justify-center space-y-4 p-8">
      <h2 className="text-xl font-semibold">Something went wrong!</h2>
      <p className="text-zoru-ink-muted">{error.message || "Failed to load payouts data."}</p>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
