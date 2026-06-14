import { notFound, redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";

import { getSabmailJourney } from "../../actions";
import {
  getSabmailJourneyRunStats,
  listSabmailJourneyRuns,
} from "../../runs-actions";
import { SabmailJourneyRunsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabmailJourneyRunsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const { id } = await params;

  // Validate the journey exists in this workspace before surfacing its runs.
  const journey = await getSabmailJourney(id);
  if (!journey) notFound();

  const [stats, runs] = await Promise.all([
    getSabmailJourneyRunStats(id),
    listSabmailJourneyRuns(id),
  ]);

  return (
    <SabmailJourneyRunsClient
      journeyId={id}
      journeyName={journey.name}
      journeyEnabled={journey.enabled}
      stats={stats}
      runs={runs}
    />
  );
}
