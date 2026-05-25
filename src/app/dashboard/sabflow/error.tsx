"use client";

import { useEffect } from "react";
import { Button } from "@/components/zoruui/button";
import { AlertCircle } from "lucide-react";

export default function SabFlowError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 text-center">
      <AlertCircle className="w-12 h-12 text-zoru-danger" />
      <h2 className="text-xl font-semibold">Something went wrong!</h2>
      <p className="text-zoru-ink-muted max-w-md">
        We encountered an error loading the SabFlow dashboard data. Please try again.
      </p>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
