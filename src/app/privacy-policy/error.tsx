"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

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
    <div className="mt-4 flex min-h-[400px] items-center justify-center">
      <EmptyState
        tone="danger"
        icon={AlertTriangle}
        title="Something went wrong"
        description="An error occurred while loading this page. Please try again or contact support if the issue persists."
        action={
          <Button variant="primary" iconLeft={RotateCcw} onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
