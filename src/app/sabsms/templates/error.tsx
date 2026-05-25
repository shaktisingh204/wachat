"use client";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";
import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, ZoruCardContent, Button } from "@/components/zoruui";
import { AlertTriangle } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SabsmsPageShell
      title="Templates"
      eyebrow="SabSMS"
      description="Manage templates"
      breadcrumbs={[{ label: "Templates" }]}
    >
      <Card className="mt-6 border-zoru-danger/50 bg-zoru-danger/5">
        <ZoruCardHeader>
          <ZoruCardTitle className="text-zoru-danger flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Error Loading Templates
          </ZoruCardTitle>
          <ZoruCardDescription>
            {error.message || "Unknown error"}
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <Button variant="outline" onClick={() => reset()}>Try Again</Button>
        </ZoruCardContent>
      </Card>
    </SabsmsPageShell>
  );
}
