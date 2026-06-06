"use client";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";
import { Card, CardHeader, CardTitle, CardDescription, CardBody, Button } from '@/components/sabcrm/20ui/compat';
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
      title="Template Editor"
      eyebrow="SabSMS"
      description="Manage template"
      breadcrumbs={[{ label: "Templates", href: "/sabsms/templates" }, { label: "Error" }]}
    >
      <Card className="mt-6 border-[var(--st-danger)]/50 bg-[var(--st-danger)]/5">
        <CardHeader>
          <CardTitle className="text-[var(--st-danger)] flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Error Loading Template
          </CardTitle>
          <CardDescription>
            {error.message || "Unknown error"}
          </CardDescription>
        </CardHeader>
        <CardBody>
          <Button variant="outline" onClick={() => reset()}>Try Again</Button>
        </CardBody>
      </Card>
    </SabsmsPageShell>
  );
}
