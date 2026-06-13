import { redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";
import { listSabmailAccounts } from "@/app/actions/sabmail-projects.actions";

import { SabmailAccountsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabmailAccountsPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const accounts = await listSabmailAccounts();

  return <SabmailAccountsClient projectId={workspaceId} initialAccounts={accounts} />;
}
