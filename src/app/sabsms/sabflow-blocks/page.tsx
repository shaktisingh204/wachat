import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";
import { SabflowBlocksClient } from "./client";
import { getCachedSession } from "@/lib/server-cache";

export default async function SabflowBlocksPage() {
  const session = await getCachedSession();
  const workspaceId = (await getSabsmsWorkspaceId()) ?? "";

  return <SabflowBlocksClient workspaceId={workspaceId} />;
}
