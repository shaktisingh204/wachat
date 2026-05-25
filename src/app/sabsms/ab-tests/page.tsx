import React from "react";
/**
 * SabSMS — `/sabsms/ab-tests` (Page 14, §B.2).
 *
 * Server entry: resolves the workspace from `getCachedSession()`,
 * loads every A/B test for the tenant via `./actions.loadAbTests`,
 * and hands the list to the client table for interactive rendering.
 * The 30 shared toolkit features (S1-S30) ride on `SabsmsPageShell`
 * + `SabsmsFilterBar` + `SabsmsDataTable`; the 20 page-unique
 * features (significance, variants, force-pick winner, simulation
 * chart, segment lift, audit trail, …) are in `ab-tests-table.tsx`.
 *
 * Stubs noted in the report:
 *  - Audit collection (`sabsms_ab_audit`) is best-effort.
 *  - Engine `stopAbTest` / `pickWinner` are forward-compatible shims
 *    (we update Mongo until the engine exposes a typed endpoint).
 */

import { getCachedSession } from "@/lib/server-cache";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";

import { AbTestsTable } from "./ab-tests-table";
import { loadAbTests } from "./actions";

export const dynamic = "force-dynamic";

async function SabsmsAbTestsPageContent() {
  const session = await getCachedSession();
  const workspaceId = String(
    (session?.user as { _id?: unknown } | undefined)?._id ?? "",
  );

  if (!workspaceId) {
    return (
      <SabsmsPageShell
        title="A/B tests"
        breadcrumbs={[{ label: "A/B tests" }]}
        description="Sign in to view your SabSMS A/B tests."
      >
        <p className="text-sm text-zoru-ink-muted">No session.</p>
      </SabsmsPageShell>
    );
  }

  const rows = await loadAbTests(workspaceId);

  return (
    <SabsmsPageShell
      title="A/B tests"
      description="Compare body copy, sender ID, or send time across variants. Each row carries a Yates-corrected chi-square p-value and a Wilson 95% CI; auto-promote fires only after the configured minimum sample is hit."
      breadcrumbs={[{ label: "A/B tests" }]}
      primaryAction={{
        label: "New campaign",
        href: "/sabsms/campaigns/new",
      }}
      secondaryActions={[
        { label: "Campaigns", onSelectHref: "/sabsms/campaigns" },
        { label: "Scheduled", onSelectHref: "/sabsms/scheduled" },
        { label: "Templates", onSelectHref: "/sabsms/templates" },
      ]}
      helpTitle="How A/B tests work"
      helpBody={
        <>
          Each row in <code className="rounded bg-zoru-surface-2 px-1">
            sabsms_ab_tests
          </code>{" "}
          carries a control variant + one or more challengers. We compute
          significance with a Yates-corrected chi-square (frequentist) by
          default; flip the per-test toggle for a beta-binomial posterior
          (Bayesian, faster decisions but no peeking guarantees). Auto-promote
          only fires when both <em>p&lt;0.05</em> and the minimum sample is
          reached.
        </>
      }
    >
      <AbTestsTable rows={rows} />
    </SabsmsPageShell>
  );
}


export default function SabsmsAbTestsPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <SabsmsAbTestsPageContent  />
    </React.Suspense>
  );
}
