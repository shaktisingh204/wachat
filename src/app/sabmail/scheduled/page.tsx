import { redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";

import { listSabmailScheduled } from "./actions";
import { SabmailScheduledClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabmailScheduledPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const scheduled = await listSabmailScheduled();

  return <SabmailScheduledClient initialScheduled={scheduled} />;
}
