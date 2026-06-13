import { redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";

import { listSabmailScreener } from "./actions";
import { SabmailScreenerClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabmailScreenerPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  // Default view = the pending queue (also surfaces fresh inbound senders).
  const initialSenders = await listSabmailScreener("pending");

  return <SabmailScreenerClient initialSenders={initialSenders} />;
}
