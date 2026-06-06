"use client";

import { useEffect } from "react";
import { Button } from "@/components/sabcrm/20ui/zoru";

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
    <div className="flex h-full flex-col items-center justify-center space-y-4 p-8">
      <h2 className="text-xl font-semibold">Something went wrong!</h2>
      <p className="text-[var(--st-text-secondary)]">{error.message || "Failed to load social media posts data."}</p>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
