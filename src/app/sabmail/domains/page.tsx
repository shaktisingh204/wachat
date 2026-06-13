import { redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";

import { listSabmailDomains, type SabmailDomainRow } from "./actions";
import { SabmailDomainsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabmailDomainsPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const res = await listSabmailDomains();
  const initialDomains: SabmailDomainRow[] = res.ok ? res.domains : [];

  return <SabmailDomainsClient initialDomains={initialDomains} />;
}
