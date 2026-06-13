import { redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";

import { getSabmailPgpStatus, type SabmailPgpStatus } from "./actions";
import { SabmailSecurityClient } from "./_client";

export const dynamic = "force-dynamic";

const EMPTY_STATUS: SabmailPgpStatus = { available: false, hasKey: false };

export default async function SabmailSecurityPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const res = await getSabmailPgpStatus();
  const initialStatus: SabmailPgpStatus = res.ok ? res.status : EMPTY_STATUS;

  return <SabmailSecurityClient initialStatus={initialStatus} />;
}
