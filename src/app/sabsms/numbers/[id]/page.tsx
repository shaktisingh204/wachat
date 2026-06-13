/**
 * /sabsms/numbers/[id] — number detail.
 *
 * Server component that resolves the workspace, loads the number doc +
 * 30d of message history (aggregated into charts), and mounts the
 * client `<NumberDetailClient>` inside the standard
 * `<SabsmsPageShell>`. Async params per Next.js 16.
 */


import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";

import { NumberDetailClient } from "./number-detail-client";
import { loadNumberDetail } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabsmsNumberDetailPage({ params }: PageProps) {
  const { id } = await params;
  const detail = await loadNumberDetail(id);

  if (!detail) {
    return (
      <SabsmsPageShell
        eyebrow="Numbers"
        title="Number not found"
        description="The number you are looking for does not exist or you do not have permission to view it."
        breadcrumbs={[
          { label: "Numbers", href: "/sabsms/numbers" },
          { label: "Not found" },
        ]}
      >
        <div className="flex h-64 flex-col items-center justify-center space-y-4 rounded-lg border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)]">
          <p className="text-sm text-[var(--st-text)]">
            This number has been released or does not exist in your workspace.
          </p>
          <a
            href="/sabsms/numbers"
            className="inline-flex items-center justify-center rounded-md bg-[var(--st-text)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--st-text)]/90"
          >
            Back to numbers
          </a>
        </div>
      </SabsmsPageShell>
    );
  }

  return (
    <SabsmsPageShell
      eyebrow="Numbers"
      title={detail.e164}
      description={
        <>
          {detail.provider} / {detail.country} / {detail.type} —{" "}
          {detail.status}
        </>
      }
      breadcrumbs={[
        { label: "Numbers", href: "/sabsms/numbers" },
        { label: detail.e164 },
      ]}
      helpTitle="What this page shows"
      helpBody={
        <>
          Health, volume, cost and assignments for a single sender. Every
          override saved here lands in{" "}
          <code className="rounded bg-[var(--st-bg-muted)] px-1">sabsms_numbers</code>
          ; release / port-out / test-send write an audit-log entry that
          surfaces in the side drawer.
        </>
      }
      secondaryActions={[
        { label: "Back to numbers", onSelectHref: "/sabsms/numbers" },
        { label: "Buy number", onSelectHref: "/sabsms/numbers/buy" },
      ]}
    >
      <NumberDetailClient detail={detail} />
    </SabsmsPageShell>
  );
}
