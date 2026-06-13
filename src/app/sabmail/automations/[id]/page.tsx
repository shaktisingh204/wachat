import { notFound, redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";

import { getSabmailJourney } from "../actions";
import { SabmailJourneyEditorClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabmailJourneyEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const { id } = await params;
  const journey = await getSabmailJourney(id);
  if (!journey) notFound();

  return <SabmailJourneyEditorClient journey={journey} />;
}
