/**
 * /sabsms/numbers/[id] — number detail.
 *
 * Server component that resolves the workspace, loads the number doc +
 * 30d of message history (aggregated into charts), and mounts the
 * client `<NumberDetailClient>` inside the standard
 * `<SabsmsPageShell>`. Async params per Next.js 16.
 */

import { notFound } from "next/navigation";

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
    notFound();
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
          <code className="rounded bg-slate-100 px-1">sabsms_numbers</code>
          ; release / port-out / test-send write an audit-log entry that
          surfaces in the side drawer.
        </>
      }
      secondaryActions={[
        { label: "Back to numbers", onSelectHref: "/sabsms/numbers" },
        { label: "Provision new", onSelectHref: "/sabsms/numbers/new" },
      ]}
    >
      <NumberDetailClient detail={detail} />
    </SabsmsPageShell>
  );
}
