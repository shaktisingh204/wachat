import { redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";

import { listSabmailContacts } from "./actions";
import { SabmailContactsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabmailContactsPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const contacts = await listSabmailContacts();

  return <SabmailContactsClient initialContacts={contacts} />;
}
