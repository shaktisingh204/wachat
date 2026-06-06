"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardBody, Button } from '@/components/sabcrm/20ui';
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
      <Card className="mt-6 border-[var(--st-danger)]/50 bg-[var(--st-danger)]/5">
        <CardHeader>
          <CardTitle className="text-[var(--st-danger)] flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Error
          </CardTitle>
          <CardDescription>
            {error.message || "Unknown error"}
          </CardDescription>
        </CardHeader>
        <CardBody>
          <Button variant="outline" onClick={() => reset()}>Try Again</Button>
        </CardBody>
      </Card>
    </div>
  );
}
