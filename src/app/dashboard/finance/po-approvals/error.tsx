"use client";

import { useEffect } from "react";
import { Button } from "@/components/zoruui";

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
    <div className="flex h-[400px] flex-col items-center justify-center space-y-4">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-red-600">Something went wrong!</h2>
        <p className="text-muted-foreground">{error.message || "Failed to load purchase orders"}</p>
      </div>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
