import React from "react";
import { getCachedSession } from "@/lib/server-cache";
import { ScheduledSendsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function ScheduledSendsPage() {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "dev-workspace");
  return <ScheduledSendsClient workspaceId={workspaceId} />;
}
