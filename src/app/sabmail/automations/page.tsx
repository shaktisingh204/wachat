import { redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";

import { listSabmailJourneys } from "./actions";
import { SabmailAutomationsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabmailAutomationsPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const journeys = await listSabmailJourneys();

  return <SabmailAutomationsClient initialJourneys={journeys} />;
}
