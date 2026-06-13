import { redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";
import { listSabmailAccounts } from "@/app/actions/sabmail-projects.actions";

import { listAutopilotAudit } from "./actions";
import { SabmailAutopilotClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabmailAutopilotPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const [accounts, audit] = await Promise.all([
    listSabmailAccounts(),
    listAutopilotAudit(),
  ]);

  return <SabmailAutopilotClient accounts={accounts} initialAudit={audit} />;
}
