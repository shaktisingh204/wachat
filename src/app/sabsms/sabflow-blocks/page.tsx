import { SabflowBlocksClient } from "./client";
import { getCachedSession } from "@/lib/server-cache";

export default async function SabflowBlocksPage() {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");

  return <SabflowBlocksClient workspaceId={workspaceId} />;
}
