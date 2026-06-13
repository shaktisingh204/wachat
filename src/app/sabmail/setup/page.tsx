import { redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";
import {
  getSabmailSetupState,
  listSabmailAccounts,
} from "@/app/actions/sabmail-projects.actions";

import { SabmailSetupClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabmailSetupPage() {
  const projectId = await getSabmailWorkspaceId();
  if (!projectId) redirect("/sabmail/projects");

  const state = await getSabmailSetupState(projectId);
  if (!state) redirect("/sabmail/projects");
  if (state.complete) redirect("/sabmail");

  const accounts = await listSabmailAccounts();

  return (
    <SabmailSetupClient
      projectId={projectId}
      initial={state}
      initialAccounts={accounts}
    />
  );
}
