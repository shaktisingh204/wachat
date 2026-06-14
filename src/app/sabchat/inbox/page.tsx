import { redirect } from "next/navigation";

import {
  getSabchatWorkspaceId,
  getActiveSabchatProject,
} from "@/lib/sabchat/workspace";
import { getSession } from "@/app/actions/user.actions";
import {
  listInboxes,
  listConversations,
} from "@/app/actions/sabchat-inbox.actions";

import { InboxClient } from "./_components/inbox-client";

export const dynamic = "force-dynamic";

export default async function SabchatInboxPage() {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) redirect("/sabchat/projects");

  const [session, inboxesRes, convRes, project] = await Promise.all([
    getSession(),
    listInboxes(),
    listConversations({ status: "open", limit: 50 }),
    getActiveSabchatProject(),
  ]);

  const user = session?.user as { _id?: unknown; name?: string } | undefined;
  const currentUserId = String(user?._id ?? "");

  // Agent roster for @mentions + bulk-assign (project owner + invited agents).
  const agents: { id: string; label: string }[] = [];
  if (currentUserId) agents.push({ id: currentUserId, label: user?.name || "Me" });
  for (const a of project?.agents ?? []) {
    const id = String(a.userId);
    if (id && id !== currentUserId) agents.push({ id, label: a.name || a.email || "Agent" });
  }

  return (
    <InboxClient
      currentUserId={currentUserId}
      initialInboxes={inboxesRes.items}
      initialConversations={convRes.items}
      agents={agents}
    />
  );
}
