import { redirect } from "next/navigation";

import { getSabchatWorkspaceId } from "@/lib/sabchat/workspace";
import { listTopics } from "@/app/actions/sabchat-community.actions";

import { CommunityClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabchatCommunityPage() {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) redirect("/sabchat/projects");

  const topics = await listTopics({ sort: "recent" });
  return <CommunityClient initialTopics={topics} />;
}
