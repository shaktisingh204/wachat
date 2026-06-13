import { redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";

import { listSabmailForms } from "./actions";
import { SabmailFormsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabmailFormsPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const forms = await listSabmailForms();

  return <SabmailFormsClient initialForms={forms} />;
}
