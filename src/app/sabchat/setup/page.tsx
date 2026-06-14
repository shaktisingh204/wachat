import { redirect } from "next/navigation";

import { getSabchatWorkspaceId } from "@/lib/sabchat/workspace";
import { getSabchatSetupState } from "@/app/actions/sabchat-projects.actions";

import { SabchatSetupClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabchatSetupPage() {
  const projectId = await getSabchatWorkspaceId();
  if (!projectId) redirect("/sabchat/projects");

  const state = await getSabchatSetupState(projectId);
  if (!state) redirect("/sabchat/projects");
  if (state.complete) redirect("/sabchat/inbox");

  return <SabchatSetupClient projectId={projectId} initial={state} />;
}
