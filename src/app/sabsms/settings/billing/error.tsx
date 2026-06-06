"use client";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";
import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, ZoruCardContent, ZoruCardFooter, Button } from "@/components/sabcrm/20ui/zoru";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

export default function ErrorBoundary({
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
    <SabsmsPageShell
      title="Billing & Credits"
      description="Manage your SMS balances, auto-top-up rules, subscriptions, and payment methods."
      eyebrow="Settings"
      breadcrumbs={[{ label: "Settings" }, { label: "Billing" }]}
    >
      <Card className="mt-6 border-[var(--st-danger)]/50 bg-[var(--st-danger)]/5">
        <ZoruCardHeader>
          <ZoruCardTitle className="text-[var(--st-danger)] flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Payment Service Unavailable
          </ZoruCardTitle>
          <ZoruCardDescription>
            We're currently unable to load your billing information.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <p className="text-sm text-[var(--st-text)]">
            Error details: {error?.message || "Unknown network error"}
          </p>
          <p className="text-sm text-[var(--st-text-secondary)]">
            Your existing credits and messaging capabilities remain unaffected. Please try again later.
          </p>
        </ZoruCardContent>
        <ZoruCardFooter>
          <Button variant="outline" onClick={() => reset()}>
            Retry Connection
          </Button>
        </ZoruCardFooter>
      </Card>
    </SabsmsPageShell>
  );
}
