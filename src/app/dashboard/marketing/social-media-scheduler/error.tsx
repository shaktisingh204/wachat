"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button, EmptyState } from "@/components/sabcrm/20ui";

export default function SocialMediaSchedulerError({
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
        icon={TriangleAlert}
        tone="danger"
        title="Something went wrong"
        description={error.message || "Failed to load social media posts data."}
        action={
          <Button variant="outline" iconLeft={RotateCcw} onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
