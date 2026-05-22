/**
 * SabSMS templates — Page 9 (`/sabsms/templates`).
 *
 * Server entry. Resolves workspace via `getCachedSession()`, builds the
 * filter object from the querystring, and hands the initial rows to the
 * client `<TemplatesTable>`. Mutations live in `./actions.ts`.
 *
 * Implements 20 page-unique features from `plans/sabsms-pages-catalog.md`
 * §B.2 (Page 9). Composition relies entirely on the SabSMS
 * `page-toolkit` primitives so the 30 shared features (S1-S30) come for
 * free.
 */

import { getCachedSession } from "@/lib/server-cache";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import {
  ZoruFeatureGrid,
  ZoruFeatureCard,
  ZoruBadge,
  StatCard,
} from "@/components/zoruui";
import { MessageSquare, CheckCircle2, Clock } from "lucide-react";

import { loadTemplates, type TemplateListFilters } from "./actions";
import { TemplatesTable } from "./templates-table";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string | string[];
    category?: string | string[];
    locale?: string | string[];
    sort?: string;
  }>;
}

function toArray(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
}

export default async function SabsmsTemplatesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
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
        <p className="text-sm text-slate-600">
          Sign in to view your SabSMS templates.
        </p>
      </SabsmsPageShell>
    );
  }

  const filters: TemplateListFilters = {
    q: sp.q,
    status: toArray(sp.status),
    category: toArray(sp.category),
    locale: toArray(sp.locale),
    sort: (sp.sort as TemplateListFilters["sort"]) ?? "newest",
  };

  const rows = await loadTemplates(workspaceId, filters);

  const approvedCount = rows.filter((r) => r.status === "approved").length;
  const pendingCount = rows.filter((r) => r.status === "submitted").length;
  const totalUsage = rows.reduce((acc, r) => acc + r.usageCount, 0);

  const topTemplates = rows.slice(0, 3); // show 3 top templates in a FeatureGrid

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
            in <code className="rounded bg-slate-100 px-1">/sabsms/templates/approvals</code>.
          </li>
          <li>
            Import accepts native SabSMS bundles or a single WhatsApp
            template JSON.
          </li>
        </ul>
      }
    >
      <div className="flex flex-col gap-10">
        {/* KPI Section */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Usage"
            value={totalUsage.toLocaleString()}
            delta={12.5}
            period="vs last month"
            icon={<MessageSquare className="h-4 w-4" />}
          />
          <StatCard
            label="Approved Templates"
            value={approvedCount}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <StatCard
            label="Pending Approval"
            value={pendingCount}
            icon={<Clock className="h-4 w-4" />}
          />
        </div>

        {/* Feature Grid for Top Templates */}
        {topTemplates.length > 0 && (
          <ZoruFeatureGrid
            columns={3}
            heading="Top Templates"
            subhead="Your most recently updated templates with their snippets."
          >
            {topTemplates.map((row) => (
              <ZoruFeatureCard
                key={row.id}
                title={
                  <div className="flex items-center gap-2">
                    <span className="truncate">{row.name}</span>
                    <ZoruBadge
                      variant={
                        row.status === "approved"
                          ? "default"
                          : row.status === "submitted"
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {row.status}
                    </ZoruBadge>
                  </div>
                }
                description={<span className="line-clamp-2">{row.bodyPreview || "(empty)"}</span>}
                icon={<MessageSquare />}
                variant="soft"
              />
            ))}
          </ZoruFeatureGrid>
        )}

        <TemplatesTable workspaceId={workspaceId} initialRows={rows} />
      </div>
    </SabsmsPageShell>
  );
}
