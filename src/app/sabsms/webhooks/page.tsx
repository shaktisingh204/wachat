import React, { Suspense } from "react";
import { getCachedSession } from "@/lib/server-cache";
import { connectToDatabase } from "@/lib/mongodb";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { StatCard } from "@/components/sabcrm/20ui";
import { fmtQty } from "@/lib/utils";
import {
  WEBHOOK_DELIVERIES_COLLECTION,
  type WebhookDeliveryDoc,
} from "@/lib/sabsms/webhooks-out/dispatch";

import { loadWebhooks, type WebhookListFilters } from "./actions";
import { WebhooksTable } from "./webhooks-table";

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

async function deliveryStats24h(workspaceId: string): Promise<{
  total: number;
  delivered: number;
  failed: number;
}> {
  try {
    const { db } = await connectToDatabase();
    const col = db.collection<WebhookDeliveryDoc>(WEBHOOK_DELIVERIES_COLLECTION);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [total, delivered, failed] = await Promise.all([
      col.countDocuments({ workspaceId, createdAt: { $gte: since } }),
      col.countDocuments({ workspaceId, createdAt: { $gte: since }, status: "delivered" }),
      col.countDocuments({ workspaceId, createdAt: { $gte: since }, status: "failed" }),
    ]);
    return { total, delivered, failed };
  } catch {
    return { total: 0, delivered: 0, failed: 0 };
  }
}

async function WebhooksDataLoader({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = String(
    (session?.user as { _id?: unknown } | undefined)?._id ?? "",
  );

  if (!workspaceId) return null;

  const filters: WebhookListFilters = {
    q: sp.q,
    status: toArray(sp.status),
    event: toArray(sp.event),
  };

  const [rows, stats] = await Promise.all([
    loadWebhooks(workspaceId, filters),
    deliveryStats24h(workspaceId),
  ]);

  const successRate =
    stats.total > 0 ? `${Math.round((stats.delivered / stats.total) * 1000) / 10}%` : "—";

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Endpoints" value={fmtQty(rows.length)} />
        <StatCard
          label="Active endpoints"
          value={fmtQty(rows.filter((r) => r.isActive).length)}
        />
        <StatCard label="Success rate (24h)" value={successRate} />
        <StatCard label="Failed deliveries (24h)" value={fmtQty(stats.failed)} />
      </div>

      <WebhooksTable workspaceId={workspaceId} initialRows={rows} />
    </>
  );
}

export default async function SabsmsWebhooksPage(props: PageProps) {
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
        <p className="text-sm text-[var(--st-text)]">
          Sign in to view your SabSMS webhooks.
        </p>
      </SabsmsPageShell>
    );
  }

  return (
    <SabsmsPageShell
      eyebrow="SabSMS"
      title="Outbound Webhooks"
      description="Signed real-time events (HMAC-SHA256) for delivery receipts, inbound messages, opt-outs and link clicks — with automatic retries and replay."
      breadcrumbs={[{ label: "Webhooks" }]}
      primaryAction={{
        label: "Add endpoint",
        href: "#new-webhook",
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
            Verify payloads: hex HMAC-SHA256 of the raw body with your endpoint secret must equal
            the X-Sabsms-Signature header (X-Sabsms-Timestamp carries the send time).
          </li>
          <li>Failed deliveries retry on a 30s → 5m → 1h → 6h backoff, then go terminal.</li>
          <li>Any delivery can be replayed from the log below.</li>
        </ul>
      }
    >
      <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-xl bg-[var(--st-bg-muted)]" />}>
        <WebhooksDataLoader {...props} />
      </Suspense>
    </SabsmsPageShell>
  );
}
