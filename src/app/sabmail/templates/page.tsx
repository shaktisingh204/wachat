import { redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";

import { listSabmailTemplates } from "./actions";
import { SabmailTemplatesClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabmailTemplatesPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const templates = await listSabmailTemplates();

  return <SabmailTemplatesClient initialTemplates={templates} />;
}
