"use client";

import { useEffect } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { Button, EmptyState } from "@/components/sabcrm/20ui";

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
    <div className="flex h-full flex-col items-center justify-center p-8">
      <EmptyState
        tone="danger"
        icon={AlertCircle}
        title="Something went wrong"
        description={error.message || "Failed to load payouts data."}
        action={
          <Button variant="primary" iconLeft={RefreshCw} onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
