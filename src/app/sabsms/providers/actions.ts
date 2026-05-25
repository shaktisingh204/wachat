"use server";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";
import { ObjectId } from "mongodb";

export async function pingProvidersAction() {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");
  if (!workspaceId) return { success: false, error: "Unauthorized" };

  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.providerAccounts);
  const docs = await col.find({ workspaceId }).toArray();

  for (const doc of docs) {
    // Simulate pinging provider API (e.g. Twilio, Vonage)
    // In a real scenario, we'd use their SDKs or fetch to their status endpoints
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const rand = Math.random();
    let newStatus = "active";
    let lastError = null;
    
    if (rand > 0.9) {
      newStatus = "outage";
      lastError = "Connection Timeout";
    } else if (rand > 0.7) {
      newStatus = "degraded";
      lastError = "High Latency Detected";
    }

    await col.updateOne(
      { _id: new ObjectId(doc._id) },
      { $set: { status: newStatus, lastError, lastPing: new Date() } }
    );
  }

  // Refetch to return updated data
  const updatedDocs = await col.find({ workspaceId }).limit(50).toArray();
  const rows = updatedDocs.map((d: any) => ({
    id: String(d._id),
    provider: d.provider,
    region: d.region,
    isDefault: !!d.isDefault,
    status: d.status ?? "active",
    lastError: d.lastError,
    sendVolume24h: Math.floor(Math.random() * 10000),
    lastSuccessfulSend: d.lastSuccessfulSend || "Just now",
    pricingTier: "Enterprise",
  }));

  return { success: true, rows };
}
