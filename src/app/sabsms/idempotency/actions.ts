"use server";

import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function fetchIdempotencyKeys(query?: string) {
  const { db } = await connectToDatabase();
  const filter = query ? { key: { $regex: query, $options: "i" } } : {};
  
  const keys = await db.collection("sabsms_idempotency_keys")
    .find(filter)
    .sort({ lastSeen: -1 })
    .limit(50)
    .toArray();

  return keys.map((k) => ({
    id: k._id.toString(),
    key: k.key,
    route: k.route || "Unknown",
    apiKey: k.apiKey || "Unknown",
    firstSeen: k.firstSeen ? new Date(k.firstSeen).toISOString() : new Date().toISOString(),
    lastSeen: k.lastSeen ? new Date(k.lastSeen).toISOString() : new Date().toISOString(),
    hash: k.hash || "N/A",
    cached: !!k.cached,
    ttl: k.ttl || "24h",
    failures: k.failures || 0,
  }));
}

export async function configureRetentionPolicy(ttlSeconds: number) {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabsms_idempotency_keys");

  // Ensure strict TTL index is set on idempotency keys
  try {
    await collection.dropIndex("expire_ttl_index");
  } catch (error) {
    // Index might not exist yet, which is fine
  }

  await collection.createIndex(
    { lastSeen: 1 },
    { expireAfterSeconds: ttlSeconds, background: true, name: "expire_ttl_index" }
  );

  return { success: true };
}

export async function invalidateIdempotencyKeys(ids: string[]) {
  const { db } = await connectToDatabase();
  const objectIds = ids.map((id) => new ObjectId(id));
  await db.collection("sabsms_idempotency_keys").deleteMany({ _id: { $in: objectIds } });
  return { success: true };
}

export async function seedMockDataIfEmpty() {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabsms_idempotency_keys");
  const count = await collection.countDocuments();
  
  if (count === 0) {
    await collection.insertMany([
      {
        key: "req_xyz789",
        route: "POST /v1/messages",
        apiKey: "pk_test_123",
        firstSeen: new Date(Date.now() - 3600000),
        lastSeen: new Date(Date.now() - 300000),
        hash: "sha256:abc123def456",
        cached: true,
        ttl: "23h 59m",
        failures: 0,
      },
      {
        key: "req_abc456",
        route: "POST /v1/campaigns",
        apiKey: "pk_prod_999",
        firstSeen: new Date(Date.now() - 7200000),
        lastSeen: new Date(Date.now() - 7200000),
        hash: "sha256:fed654cba321",
        cached: false,
        ttl: "23h 14m",
        failures: 2,
      },
      {
        key: "req_foo123",
        route: "POST /v1/messages",
        apiKey: "pk_prod_999",
        firstSeen: new Date(Date.now() - 8640000),
        lastSeen: new Date(Date.now() - 8600000),
        hash: "sha256:111222333444",
        cached: true,
        ttl: "22h 30m",
        failures: 0,
      }
    ]);
  }
}
