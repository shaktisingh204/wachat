import { redirect } from "next/navigation";

import { getSabchatWorkspaceId } from "@/lib/sabchat/workspace";
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

  const [session, inboxesRes, convRes] = await Promise.all([
    getSession(),
    listInboxes(),
    listConversations({ status: "open", limit: 50 }),
  ]);

  const currentUserId = String(
    (session?.user as { _id?: unknown } | undefined)?._id ?? "",
  );

  return (
    <InboxClient
      currentUserId={currentUserId}
      initialInboxes={inboxesRes.items}
      initialConversations={convRes.items}
    />
  );
}
