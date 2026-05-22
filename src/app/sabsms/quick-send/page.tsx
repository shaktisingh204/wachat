import { redirect } from "next/navigation";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { getCachedSession } from "@/lib/server-cache";

import { listSenderNumbers } from "./actions";
import { QuickSendClient } from "./quick-send-client";

export const dynamic = "force-dynamic";

export default async function SabsmsQuickSendPage() {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: string } | null)?._id;
  if (!userId) {
    redirect("/login?next=/sabsms/quick-send");
  }
  const workspaceId = String(userId);

  // Sender pool — read directly from `sabsms_numbers` via the server action.
  const senderNumbers = await listSenderNumbers();

  return (
    <SabsmsPageShell
      eyebrow="Outbound"
      title="Quick send"
      description={
        <>
          Paste a list, render per-recipient previews, and launch through
          the SabSMS engine in one flow. Designed for ad-hoc bulk —
          reach for{" "}
          <a className="underline" href="/sabsms/send">
            /sabsms/send
          </a>{" "}
          for a one-off and{" "}
          <a className="underline" href="/sabsms/campaigns/new">
            /sabsms/campaigns/new
          </a>{" "}
          for scheduled, segmented, recurring runs.
        </>
      }
      breadcrumbs={[{ label: "Quick send" }]}
      helpTitle="What is Quick send?"
      helpBody={
        <div className="space-y-2">
          <p>
            <strong>Quick send</strong> is the bulk-paste route. It takes
            a list of phones (newline, comma, or TSV/CSV with a header),
            normalises and dedupes them, and pushes each one through the
            engine with a shared body.
          </p>
          <p>
            <strong>vs. /sabsms/send</strong> — that page is a one-shot
            composer (single recipient, live DLR polling).
          </p>
          <p>
            <strong>vs. /sabsms/campaigns/new</strong> — that page is the
            full wizard (segments, scheduling, throttle caps, drips,
            compliance review). Use the "Save as campaign" button here
            to graduate a paste into a saved campaign.
          </p>
        </div>
      }
    >
      <QuickSendClient
        workspaceId={workspaceId}
        senderNumbers={senderNumbers}
      />
    </SabsmsPageShell>
  );
}
