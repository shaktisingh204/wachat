"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-6">
      <Card className="mt-6 border-red-500/50 bg-red-500/5">
        <CardHeader>
          <CardTitle className="text-red-500 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Error
          </CardTitle>
          <CardDescription>
            {error.message || "Unknown error"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => reset()}>Try Again</Button>
        </CardContent>
      </Card>
    </div>
  );
}
