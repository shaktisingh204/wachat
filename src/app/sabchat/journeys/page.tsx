import { redirect } from "next/navigation";

import { getSabchatWorkspaceId } from "@/lib/sabchat/workspace";
import { listJourneys } from "@/app/actions/sabchat-journeys.actions";

import { JourneysClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabchatJourneysPage() {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) redirect("/sabchat/projects");

  const journeys = await listJourneys();
  return <JourneysClient initialJourneys={journeys} />;
}
