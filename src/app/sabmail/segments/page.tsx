import { redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";

import { listSabmailSegments } from "./actions";
import { SabmailSegmentsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabmailSegmentsPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const segments = await listSabmailSegments();

  return <SabmailSegmentsClient initialSegments={segments} />;
}
