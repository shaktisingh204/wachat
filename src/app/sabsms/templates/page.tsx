import React, { Suspense } from "react";
import { getCachedSession } from "@/lib/server-cache";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { FeatureGrid, FeatureCard, Badge, StatCard } from '@/components/sabcrm/20ui';
import { MessageSquare, CheckCircle2, Clock } from "lucide-react";
import { fmtQty } from "@/lib/utils";

import { loadTemplates, type TemplateListFilters } from "./actions";
import { TemplatesTable } from "./templates-table";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string | string[];
    category?: string | string[];
    locale?: string | string[];
    tags?: string | string[];
    sort?: string;
    page?: string;
    limit?: string;
  }>;
}

function toArray(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
}

async function TemplatesDataLoader({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = String(
    (session?.user as { _id?: unknown } | undefined)?._id ?? "",
  );

  if (!workspaceId) return null;

  const filters: TemplateListFilters = {
    q: sp.q,
    status: toArray(sp.status),
    category: toArray(sp.category),
    locale: toArray(sp.locale),
    tags: toArray(sp.tags),
    sort: (sp.sort as TemplateListFilters["sort"]) ?? "newest",
    page: sp.page ? parseInt(sp.page, 10) : 1,
    limit: sp.limit ? parseInt(sp.limit, 10) : 50,
  };

  const { rows, total } = await loadTemplates(workspaceId, filters);

  const kpis = await import("./actions").then((m) => m.getTemplateKpis(workspaceId));
  const availableTags = await import("./actions").then((m) => m.getAvailableTags(workspaceId));

  const topTemplates = rows.slice(0, 3); // show 3 top templates in a FeatureGrid

  return (
    <div className="flex flex-col gap-10">
      {/* KPI Section */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Usage"
          value={fmtQty(kpis.totalUsage)}
          icon={<MessageSquare className="h-4 w-4" />}
        />
        <StatCard
          label="Approved Templates"
          value={kpis.approvedCount}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Pending Approval"
          value={kpis.pendingCount}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Feature Grid for Top Templates */}
      {topTemplates.length > 0 && (
        <FeatureGrid
          columns={3}
          heading="Top Templates"
          subhead="Your most recently updated templates with their snippets."
        >
          {topTemplates.map((row) => (
            <FeatureCard
              key={row.id}
              title={
                <div className="flex items-center gap-2">
                  <span className="truncate">{row.name}</span>
                  <Badge
                    variant={
                      row.status === "approved"
                        ? "default"
                        : row.status === "submitted"
                          ? "outline"
                          : "secondary"
                    }
                  >
                    {row.status}
                  </Badge>
                </div>
              }
              description={<span className="line-clamp-2">{row.bodyPreview || "(empty)"}</span>}
              icon={<MessageSquare />}
              variant="soft"
            />
          ))}
        </FeatureGrid>
      )}

      <TemplatesTable
        workspaceId={workspaceId}
        initialRows={rows}
        totalCount={total}
        page={filters.page ?? 1}
        limit={filters.limit ?? 50}
        availableTags={availableTags}
      />
    </div>
  );
}

export default async function SabsmsTemplatesPage(props: PageProps) {
  const session = await getCachedSession();
  const workspaceId = String(
    (session?.user as { _id?: unknown } | undefined)?._id ?? "",
  );

  if (!workspaceId) {
    return (
      <SabsmsPageShell
        title="Templates"
        breadcrumbs={[{ label: "Templates" }]}
        eyebrow="SabSMS"
      >
        <p className="text-sm text-[var(--st-text)]">
          Sign in to view your SabSMS templates.
        </p>
      </SabsmsPageShell>
    );
  }

  return (
    <SabsmsPageShell
      eyebrow="SabSMS"
      title="Templates"
      description="Compose, register, and submit SMS templates for carrier approval. Filter, duplicate, deprecate, and import bundles."
      breadcrumbs={[{ label: "Templates" }]}
      primaryAction={{
        label: "New template",
        href: "/sabsms/templates/new",
      }}
      secondaryActions={[
        {
          label: "Approval queue",
          onSelectHref: "/sabsms/templates/approvals",
        },
        {
          label: "Per-template analytics",
          onSelectHref: "/sabsms/analytics",
        },
      ]}
      helpTitle="Templates"
      helpBody={
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Use the duplicate row action to fork an approved template into
            a new draft.
          </li>
          <li>
            Bulk-submit drafts from the action bar; submissions queue up
            in <code className="rounded bg-[var(--st-bg-muted)] px-1">/sabsms/templates/approvals</code>.
          </li>
          <li>
            Import accepts native SabSMS bundles or a single WhatsApp
            template JSON.
          </li>
        </ul>
      }
    >
      <Suspense fallback={<div className="h-96 w-full animate-pulse bg-[var(--st-bg-muted)] rounded-xl" />}>
        <TemplatesDataLoader {...props} />
      </Suspense>
    </SabsmsPageShell>
  );
}
