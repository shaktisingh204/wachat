import { getCachedSession } from "@/lib/server-cache";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";

import { loadWebhooks, type WebhookListFilters } from "./actions";
import { WebhooksTable } from "./webhooks-table";
import { StatCard } from "@/components/zoruui";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string | string[];
    event?: string | string[];
  }>;
}

function toArray(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
}

export default async function SabsmsWebhooksPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = String(
    (session?.user as { _id?: unknown } | undefined)?._id ?? "",
  );

  if (!workspaceId) {
    return (
      <SabsmsPageShell
        title="Webhooks"
        breadcrumbs={[{ label: "Webhooks" }]}
        eyebrow="SabSMS"
      >
        <p className="text-sm text-slate-600">
          Sign in to view your SabSMS webhooks.
        </p>
      </SabsmsPageShell>
    );
  }

  const filters: WebhookListFilters = {
    q: sp.q,
    status: toArray(sp.status),
    event: toArray(sp.event),
  };

  const rows = await loadWebhooks(workspaceId, filters);

  return (
    <SabsmsPageShell
      eyebrow="SabSMS"
      title="Outbound Webhooks"
      description="Configure and manage outbound webhooks to receive real-time updates for DLRs, inbound messages, and more."
      breadcrumbs={[{ label: "Webhooks" }]}
      primaryAction={{
        label: "Add endpoint",
        href: "#new-webhook", // Typically this opens a modal or navigates to a new page
      }}
      secondaryActions={[
        {
          label: "Delivery logs",
          onSelectHref: "/sabsms/webhooks/log",
        },
        {
          label: "API docs",
          onSelectHref: "/sabsms/api-docs",
        },
      ]}
      helpTitle="Webhooks"
      helpBody={
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Use webhooks to sync delivery receipts and inbound messages to your system.
          </li>
          <li>
            Verify incoming payloads using the HMAC-SHA256 signature provided in the headers.
          </li>
          <li>
            Endpoints that repeatedly fail or time out will be disabled automatically.
          </li>
        </ul>
      }
    >
      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          label="Total Webhooks"
          value={rows.length.toLocaleString()}
          delta={2}
          period="vs last month"
        />
        <StatCard
          label="Active Endpoints"
          value={rows.filter((r) => r.isActive).length.toLocaleString()}
          delta={5}
          period="vs last month"
        />
        <StatCard
          label="Avg Success Rate"
          value="99.9%"
          delta={0.1}
          period="vs last month"
        />
        <StatCard
          label="Failed Deliveries (24h)"
          value="12"
          delta={-5}
          invertDelta
          period="vs last month"
        />
      </div>

      <WebhooksTable workspaceId={workspaceId} initialRows={rows} />
    </SabsmsPageShell>
  );
}
