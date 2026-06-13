import { redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";
import { listSabmailSuppressionsRaw } from "@/lib/sabmail/suppressions";

import { SabmailSuppressionsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabmailSuppressionsPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const suppressions = await listSabmailSuppressionsRaw(workspaceId);

  return <SabmailSuppressionsClient initialSuppressions={suppressions} />;
}
