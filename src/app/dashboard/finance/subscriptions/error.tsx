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
    <div className="20ui flex h-full flex-col items-center justify-center p-8">
      <EmptyState
        icon={AlertTriangle}
        tone="danger"
        title="Something went wrong"
        description={error.message}
        action={
          <Button variant="outline" onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
