"use client";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";
import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, ZoruCardContent, Button } from "@/components/sabcrm/20ui/zoru";
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
      title="Outbound Webhooks"
      eyebrow="SabSMS"
      description="Manage webhooks"
      breadcrumbs={[{ label: "Webhooks" }]}
    >
      <Card className="mt-6 border-[var(--st-danger)]/50 bg-[var(--st-danger)]/5">
        <ZoruCardHeader>
          <ZoruCardTitle className="text-[var(--st-danger)] flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Error Loading Webhooks
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
