import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";
import { NumbersClient, type NumberRow } from "./numbers-client";

export const dynamic = "force-dynamic";

async function loadNumbers(workspaceId: string): Promise<NumberRow[]> {
  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.numbers);
  const docs = await col
    .find({ workspaceId })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  return docs.map((d: any) => ({
    id: String(d._id),
    e164: d.e164,
    country: d.country ?? "—",
    type: d.type ?? "longcode",
    provider: d.provider ?? "—",
    status: d.status ?? "active",
    capabilities: d.capabilities ?? { sms: true, mms: false, rcs: false, voice: false },
    healthDlr: 99.5, // Mock data for phase 1 UI
    healthComplaint: 0.01,
    monthlyCost: 1.00,
    lastUsedAt: d.updatedAt ? new Date(d.updatedAt).toLocaleDateString() : "Never",
    sendVolume24h: Math.floor(Math.random() * 1000)
  }));
}

export default async function SabsmsNumbersPage() {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");
  const rows = workspaceId ? await loadNumbers(workspaceId) : [];

  const fallbackFrom = process.env.SABSMS_TWILIO_DEFAULT_FROM ?? "";

  return (
    <NumbersClient rows={rows} fallbackFrom={fallbackFrom} />
  );
}

