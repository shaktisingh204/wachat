import { redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";
import { listSabmailAccounts } from "@/app/actions/sabmail-projects.actions";

import { getSabmailSettings, type SabmailSettingsDoc } from "./actions";
import { SabmailSettingsClient } from "./_client";

export const dynamic = "force-dynamic";

const EMPTY_SETTINGS: SabmailSettingsDoc = {
  defaultFromAccountId: null,
  signatureHtml: null,
  blockRemoteImages: true,
  updatedAt: null,
};

export default async function SabmailSettingsPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const [settingsRes, accounts] = await Promise.all([
    getSabmailSettings(),
    listSabmailAccounts(),
  ]);

  const settings = settingsRes.ok ? settingsRes.settings : EMPTY_SETTINGS;

  return <SabmailSettingsClient initialSettings={settings} accounts={accounts} />;
}
