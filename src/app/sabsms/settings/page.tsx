import React, { Suspense } from "react";

import {
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
} from "@/components/sabcrm/20ui";

import { getSabsmsSettingsAction } from "./actions";
import { getAgentConfigAction } from "./agent-actions";
import { getGovernanceSettingsAction } from "./governance-actions";
import { AgentSettingsCard } from "./agent-card";
import { GovernanceSettingsCard } from "./governance-card";
import { RcsSettingsCard } from "./rcs-card";
import { ResellerSettingsCard } from "./reseller-card";
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
    <div className="space-y-6">
      <ShortLinksSettingsCard
        initialDomain={res.settings.shortLinkDomain}
        initialBase={res.settings.effectiveShortLinkBase}
      />
      <RcsSettingsCard initialEnabled={res.settings.rcsEnabled} />
    </div>
  );
}

/** V2.12 — AI agent configuration (same RBAC gate as the other cards). */
async function AgentContent() {
  const res = await getAgentConfigAction();
  if (!res.success) {
    return (
      <p className="rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-sm text-[var(--st-text)]">
        {res.error}
      </p>
    );
  }
  return <AgentSettingsCard initialConfig={res.config} />;
}

/** V3 — channel governance (geo + frequency cap) + WhatsApp linkage. */
async function GovernanceContent() {
  const res = await getGovernanceSettingsAction();
  if (!res.success) {
    return (
      <p className="rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-sm text-[var(--st-text)]">
        {res.error}
      </p>
    );
  }
  return <GovernanceSettingsCard initial={res.settings} />;
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

      <Suspense fallback={null}>
        <AgentContent />
      </Suspense>

      {/* V3 — channel governance + WhatsApp linkage. */}
      <Suspense fallback={null}>
        <GovernanceContent />
      </Suspense>

      {/* V2.13 — reseller engine (rate cards + margin report). */}
      <Suspense fallback={null}>
        <ResellerSettingsCard />
      </Suspense>
    </div>
  );
}
