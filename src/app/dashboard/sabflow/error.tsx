'use client';

import { useEffect } from "react";
import { Button } from "@/components/zoruui/button";
import { AlertCircle } from "lucide-react";
import { PageHeader, ZoruPageHeading, ZoruPageTitle, ZoruPageDescription } from "@/components/zoruui/page-header";

export default function SabFlowError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("SabFlow Dashboard Error:", error);
  }, [error]);

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center max-w-md text-center space-y-4">
        <div className="p-4 bg-zoru-danger/10 rounded-full text-zoru-danger">
          <AlertCircle className="w-12 h-12" />
        </div>
        <ZoruPageHeading className="items-center">
          <ZoruPageTitle>Failed to load Dashboard</ZoruPageTitle>
          <ZoruPageDescription className="text-center">
            {error.message || "An unexpected error occurred while loading SabFlow statistics."}
          </ZoruPageDescription>
        </ZoruPageHeading>
        <Button onClick={() => reset()} variant="primary">
          Try again
        </Button>
      </div>
    </div>
  );
}
