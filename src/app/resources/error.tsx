"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, EmptyState } from "@/components/sabcrm/20ui";

export default function Error({
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
    <div className="20ui mt-4 flex min-h-[400px] flex-col items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-8">
      <EmptyState
        icon={AlertTriangle}
        tone="danger"
        title="Something went wrong"
        description="An error occurred while loading this page. Please try again or contact support if the issue persists."
        action={
          <Button variant="primary" onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
