import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";
import React from "react";
import { getCachedSession } from "@/lib/server-cache";
import { ScheduledSendsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function ScheduledSendsPage() {
  const session = await getCachedSession();
  const workspaceId = (await getSabsmsWorkspaceId()) ?? "";
  return <ScheduledSendsClient workspaceId={workspaceId} />;
}
