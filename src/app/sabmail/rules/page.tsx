import { redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";
import { listSabmailAccounts } from "@/app/actions/sabmail-projects.actions";

import { listSabmailRules } from "./actions";
import { SabmailRulesClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabmailRulesPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const [rules, accounts] = await Promise.all([
    listSabmailRules(),
    listSabmailAccounts(),
  ]);

  return (
    <SabmailRulesClient
      initialRules={rules}
      accounts={accounts.map((a) => ({
        id: a.id,
        email: a.email,
        displayName: a.displayName,
        provider: a.provider,
      }))}
    />
  );
}
