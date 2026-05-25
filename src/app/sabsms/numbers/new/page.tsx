/**
 * /sabsms/numbers/new — Phase 1 provisioning wizard.
 *
 * Server component that resolves the workspace, loads the wizard
 * context (campaign + pool options, compliance readiness flags), and
 * mounts the client `<ProvisionWizard>` inside the standard
 * `<SabsmsPageShell>`.
 */

import { redirect } from "next/navigation";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";

import { ProvisionWizard } from "./provision-wizard";
import { loadProvisioningContext } from "./actions";

export const dynamic = "force-dynamic";

export default async function SabsmsProvisionNumberPage() {
  const { workspaceId, campaigns, pools, complianceReady } =
    await loadProvisioningContext();

  if (!workspaceId) {
    redirect("/login");
  }

  return (
    <SabsmsPageShell
      eyebrow="Numbers"
      title="Provision a number"
      description={
        <>
          Pick a provider, country and shape. Phase 1 wires Twilio
          end-to-end; the remaining 12 carriers light up in Phase 7.
        </>
      }
      breadcrumbs={[
        { label: "Numbers", href: "/sabsms/numbers" },
        { label: "Provision" },
      ]}
      helpTitle="Provisioning, the short version"
      helpBody={
        <>
          We{`’`}ll write a {`pending`} row to{" "}
          <code className="rounded bg-slate-100 px-1">sabsms_numbers</code>{" "}
          and an audit-log entry. The engine flips the row to{" "}
          {`active`} after the provider call returns.
        </>
      }
      secondaryActions={[
        { label: "Back to numbers", onSelectHref: "/sabsms/numbers" },
        { label: "Configure providers", onSelectHref: "/sabsms/providers" },
      ]}
    >
      <ProvisionWizard
        campaigns={campaigns}
        pools={pools}
        complianceReady={complianceReady}
      />
    </SabsmsPageShell>
  );
}
