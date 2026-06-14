import { redirect } from "next/navigation";

import { Card, EmptyState } from "@/components/sabcrm/20ui";
import { AlertTriangle } from "lucide-react";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";
import { loadUnifiedInbox } from "./actions";
import { UnifiedInboxClient } from "./_components/unified-inbox-client";

export const dynamic = "force-dynamic";

export default async function SabmailUnifiedInboxPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const data = await loadUnifiedInbox();
  if (!data.ok) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <Card className="p-10">
          <EmptyState
            icon={<AlertTriangle aria-hidden />}
            title="Couldn't load the unified inbox"
            description={data.error}
          />
        </Card>
      </div>
    );
  }

  return <UnifiedInboxClient data={data} />;
}
