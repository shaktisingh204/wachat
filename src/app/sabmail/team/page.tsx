import { redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";

import { listTeamConversations, listTeamMembers } from "./actions";
import { SabmailTeamClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabmailTeamPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const [conversations, members] = await Promise.all([
    listTeamConversations("all"),
    listTeamMembers(),
  ]);

  return (
    <SabmailTeamClient
      initialConversations={conversations}
      members={members}
    />
  );
}
