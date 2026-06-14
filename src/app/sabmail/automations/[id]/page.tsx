import { notFound, redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";
import { listSabmailAccounts } from "@/app/actions/sabmail-projects.actions";

import { getSabmailJourney } from "../actions";
import { SabmailJourneyEditorClient, type SabmailJourneyMailbox } from "./_client";

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

  // Mailboxes that the Send node can dispatch from (same source as the inbox).
  const mailboxes: SabmailJourneyMailbox[] = (await listSabmailAccounts()).map(
    (a) => ({
      id: a.id,
      email: a.email,
      displayName: a.displayName,
    }),
  );

  return (
    <SabmailJourneyEditorClient journey={journey} mailboxes={mailboxes} />
  );
}
