import React, { Suspense } from "react";

import {
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
} from "@/components/sabcrm/20ui";

import { getSabsmsSettingsAction } from "./actions";
import { ShortLinksSettingsCard } from "./short-links-card";

export const dynamic = "force-dynamic";

async function SettingsContent() {
  const res = await getSabsmsSettingsAction();
  if (!res.success) {
    return (
      <p className="rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-sm text-[var(--st-text)]">
        {res.error}
      </p>
    );
  }
  return (
    <ShortLinksSettingsCard
      initialDomain={res.settings.shortLinkDomain}
      initialBase={res.settings.effectiveShortLinkBase}
    />
  );
}

export default function SabsmsSettingsPage() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Settings</PageTitle>
          <PageDescription>
            Workspace-level SabSMS configuration. Team, billing, and
            notification settings live in their own tabs.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <Suspense fallback={null}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}
