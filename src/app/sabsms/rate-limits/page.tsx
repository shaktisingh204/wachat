import { getCachedSession } from "@/lib/server-cache";
import RateLimitsClient from "./rate-limits-client";

export const dynamic = "force-dynamic";

export default async function RateLimitsPage() {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");

  // In a real app we might fetch global rate limits config here
  // For now, we mock data for the UI
  return <RateLimitsClient workspaceId={workspaceId} />;
}
