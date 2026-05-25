import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";
import { NumbersClient, type NumberRow } from "./numbers-client";

export const dynamic = "force-dynamic";

async function loadNumbers(workspaceId: string): Promise<NumberRow[]> {
  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.numbers);
  const messagesCol = db.collection(SABSMS_COLLECTIONS.messages);
  
  const docs = await col
    .find({ workspaceId })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  if (docs.length === 0) return [];

  const e164s = docs.map(d => d.e164);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const metrics = await messagesCol.aggregate([
    { 
      $match: { 
        workspaceId, 
        from: { $in: e164s }, 
        createdAt: { $gte: yesterday } 
      } 
    },
    { 
      $group: {
        _id: "$from",
        sendVolume24h: { $sum: 1 },
        delivered: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
        complaint: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } }
      }
    }
  ]).toArray();

  const metricsByFrom = new Map(metrics.map(m => [String(m._id), m]));

  return docs.map((d: any) => {
    const m = (metricsByFrom.get(d.e164) as any) || { sendVolume24h: 0, delivered: 0, failed: 0, complaint: 0 };
    const totalAttempted = m.delivered + m.failed;
    const dlr = totalAttempted > 0 ? (m.delivered / totalAttempted) * 100 : 100;
    const cmp = m.sendVolume24h > 0 ? (m.complaint / m.sendVolume24h) * 100 : 0;

    return {
      id: String(d._id),
      e164: d.e164,
      country: d.country ?? "—",
      type: d.type ?? "longcode",
      provider: d.provider ?? "—",
      status: d.status ?? "active",
      capabilities: d.capabilities ?? { sms: true, mms: false, rcs: false, voice: false },
      healthDlr: Number(dlr.toFixed(1)),
      healthComplaint: Number(cmp.toFixed(2)),
      monthlyCost: d.monthlyCost ?? 0,
      webhookUrl: d.webhookUrl ?? "",
      routingUrl: d.routingUrl ?? "",
      lastUsedAt: d.updatedAt ? new Date(d.updatedAt).toLocaleDateString() : "Never",
      sendVolume24h: m.sendVolume24h
    };
  });
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
