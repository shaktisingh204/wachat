import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { PoolClient, type PoolRow } from "./pool-client";

export const dynamic = "force-dynamic";

async function loadPools(workspaceId: string): Promise<PoolRow[]> {
  // Mock data for Phase 1 UI since 'sabsms_sender_pools' collection doesn't exist yet
  return [
    {
      id: "pool-1",
      name: "Marketing US-East",
      rotationStrategy: "round-robin",
      stickyPerRecipient: true,
      throttlePerSecond: 100,
      quietHours: { enabled: true, start: "22:00", end: "08:00", tz: "America/New_York" },
      numbersCount: 5,
      campaignsAssigned: 2,
      healthDlr: 99.1,
      healthComplaint: 0.05,
      monthlyCost: 45.0,
      capacityMsgsSec: 50,
      status: "active",
      geomatch: true
    },
    {
      id: "pool-2",
      name: "Transactional Global",
      rotationStrategy: "hash-by-recipient",
      stickyPerRecipient: true,
      throttlePerSecond: 500,
      quietHours: { enabled: false, start: "00:00", end: "00:00", tz: "UTC" },
      numbersCount: 12,
      campaignsAssigned: 5,
      healthDlr: 99.8,
      healthComplaint: 0.01,
      monthlyCost: 120.0,
      capacityMsgsSec: 300,
      status: "active",
      geomatch: false
    },
    {
      id: "pool-3",
      name: "Abandoned Cart UK",
      rotationStrategy: "least-loaded",
      stickyPerRecipient: false,
      throttlePerSecond: 20,
      quietHours: { enabled: true, start: "20:00", end: "09:00", tz: "Europe/London" },
      numbersCount: 2,
      campaignsAssigned: 1,
      healthDlr: 95.5,
      healthComplaint: 0.15,
      monthlyCost: 18.0,
      capacityMsgsSec: 10,
      status: "degraded",
      geomatch: false
    }
  ];
}

export default async function SabsmsPoolPage() {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");
  const rows = workspaceId ? await loadPools(workspaceId) : [];

  return (
    <PoolClient rows={rows} />
  );
}
