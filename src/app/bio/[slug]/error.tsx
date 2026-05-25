"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="flex flex-col items-center gap-4 text-center max-w-md p-8 rounded-2xl bg-zinc-900/50 border border-red-500/20">
        <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Something went wrong!</h2>
          <p className="mt-2 text-sm text-zinc-400">
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
