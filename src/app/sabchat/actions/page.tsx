import { redirect } from "next/navigation";

import { getSabchatWorkspaceId } from "@/lib/sabchat/workspace";
import { listConnectors, listActionRuns } from "@/app/actions/sabchat-ai-actions.actions";

import { ActionsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabchatActionsPage() {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) redirect("/sabchat/projects");

  const [connectors, runs] = await Promise.all([listConnectors(), listActionRuns()]);
  return <ActionsClient initialConnectors={connectors} initialRuns={runs} />;
}
