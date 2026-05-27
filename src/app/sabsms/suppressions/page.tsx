/**
 * SabSMS suppressions — server entry.
 *
 * Resolves the workspace, hydrates the suppression list + KPI tiles +
 * editor support data, then hands them to the interactive client
 * surface. Search params drive URL-state filters, source facets, date
 * range, sort, and pagination so deep links round-trip.
 *
 * Catalog reference: `plans/sabsms-pages-catalog.md` Page 20 §B.3.
 */

import React, { Suspense } from "react";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { getCachedSession } from "@/lib/server-cache";
import { fmtQty } from "@/lib/utils";

import {
  type SuppressionFilters,
  loadAutoSuppressRules,
  loadCampaignsForOverlap,
  loadCostAvoided24h,
  loadCoverage,
  loadReasonTaxonomy,
  loadSuppressions,
} from "./actions";
import { SuppressionsTable } from "./suppressions-table";
import type { SabsmsSuppressionSource } from "@/lib/sabsms/types";

export const dynamic = "force-dynamic";

interface SuppressionsPageProps {
  searchParams: Promise<{
    q?: string;
    source?: string | string[];
    sort?: string;
    from?: string;
    to?: string;
    page?: string;
    pageSize?: string;
  }>;
}

function asArray(v: string | string[] | undefined): string[] | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v : [v];
}

async function SuppressionsDataLoader({ searchParams }: SuppressionsPageProps) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = String(
    (session?.user as { _id?: unknown } | undefined)?._id ?? "",
  );
  const role = String(
    (session?.user as { role?: unknown } | undefined)?.role ?? "",
  );
  const isAdmin = role === "admin";

  if (!workspaceId) {
    return <></>;
  }

  const page = Math.max(0, parseInt(sp.page ?? "0", 10) || 0);
  const pageSize = Math.max(
    1,
    Math.min(250, parseInt(sp.pageSize ?? "50", 10) || 50),
  );

  const filters: SuppressionFilters = {
    q: sp.q,
    source: asArray(sp.source) as SabsmsSuppressionSource[] | undefined,
    sort: (sp.sort as SuppressionFilters["sort"]) ?? "newest",
    from: sp.from,
    to: sp.to,
    page,
    pageSize,
  };

  const [
    { rows, total },
    coverage,
    costAvoidedUsd,
    campaigns,
    autoRules,
    reasonTaxonomy,
  ] = await Promise.all([
    loadSuppressions(workspaceId, filters),
    loadCoverage(workspaceId),
    loadCostAvoided24h(workspaceId),
    loadCampaignsForOverlap(workspaceId),
    loadAutoSuppressRules(workspaceId),
    loadReasonTaxonomy(workspaceId),
  ]);

  return (
    <SuppressionsTable
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      coverage={coverage}
      costAvoidedUsd={costAvoidedUsd}
      campaigns={campaigns}
      autoRules={autoRules}
      reasonTaxonomy={reasonTaxonomy}
      isAdmin={isAdmin}
    />
  );
}

export default function SabsmsSuppressionsPage(props: SuppressionsPageProps) {
  return (
    <SabsmsPageShell
      eyebrow="Compliance"
      title="Suppressions"
      description={
        <>
          Phone hashes that the engine will never send to. STOP replies,
          carrier complaints, and manual blocks all land here.{" "}
        </>
      }
      breadcrumbs={[
        { label: "Compliance" },
        { label: "Suppressions" },
      ]}
      helpTitle="What is the suppression list?"
      helpBody={
        <>
          We store only the SHA-256 hash of each phone — never the raw
          E.164. That keeps the list useful after a GDPR erasure request.
          Search accepts <code>+E.164</code> (auto-hashed) or a 64-char
          hash directly.
        </>
      }
    >
      <Suspense fallback={<div className="h-96 w-full animate-pulse bg-zoru-surface-2 rounded-xl" />}>
        <SuppressionsDataLoader {...props} />
      </Suspense>
    </SabsmsPageShell>
  );
}
