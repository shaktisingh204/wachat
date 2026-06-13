import { redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";
import { listSabmailAccounts } from "@/app/actions/sabmail-projects.actions";

import { listSabmailCampaigns } from "./actions";
import { SabmailCampaignsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabmailCampaignsPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const [campaigns, accounts] = await Promise.all([
    listSabmailCampaigns(),
    listSabmailAccounts(),
  ]);

  return <SabmailCampaignsClient initialCampaigns={campaigns} accounts={accounts} />;
}
