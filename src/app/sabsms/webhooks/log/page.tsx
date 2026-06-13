import React, { Suspense } from "react";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";

import { DeliveriesPanel } from "../deliveries-panel";

export const dynamic = "force-dynamic";

/**
 * /sabsms/webhooks/log — the full-page view of the real
 * `sabsms_webhook_deliveries` log (same panel the webhooks page embeds,
 * with a larger page size).
 */
export default function WebhookLogPage() {
  return (
    <SabsmsPageShell
      eyebrow="SabSMS"
      title="Webhook delivery log"
      description="Every outbound webhook POST: status, attempts, last HTTP code and retry schedule. Replay re-enqueues through the production dispatcher."
      breadcrumbs={[
        { label: "Webhooks", href: "/sabsms/webhooks" },
        { label: "Delivery log" },
      ]}
      secondaryActions={[{ label: "Manage endpoints", onSelectHref: "/sabsms/webhooks" }]}
    >
      <Suspense
        fallback={<div className="h-96 w-full animate-pulse rounded-xl bg-[var(--st-bg-muted)]" />}
      >
        <DeliveriesPanel limit={300} />
      </Suspense>
    </SabsmsPageShell>
  );
}
