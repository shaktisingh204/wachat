// PORT-NOTE: pg-migration->mongo-index/seed
// Original:
//   1. CREATE TYPE "core"."agentMessage_status_enum" AS ENUM ('queued', 'sent')
//   2. ADD COLUMN "status" … NOT NULL DEFAULT 'sent'
//   3. ALTER COLUMN "turnId" DROP NOT NULL
//   4. ADD COLUMN "processedAt" TIMESTAMPTZ
//   5. UPDATE SET processedAt = createdAt WHERE status = 'sent'
//
// Mongo equivalent: seed defaults on existing documents and set processedAt.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export type AgentMessageStatus = "queued" | "sent";

export async function applyMigration1775001600000(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_agentMessage");

  // Default status = 'sent' for existing docs that lack the field.
  await col.updateMany(
    { status: { $exists: false } },
    { $set: { status: "sent" as AgentMessageStatus } },
  );

  // Back-fill processedAt = createdAt for all 'sent' messages.
  // Use an aggregation pipeline update to copy a field value.
  await col.updateMany({ status: "sent", processedAt: { $exists: false } }, [
    { $set: { processedAt: "$createdAt" } },
  ]);
}

/** Reversal: remove processedAt and status; delete messages with null turnId. */
export async function rollbackMigration1775001600000(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_agentMessage");

  // Remove queued messages that have no turnId (mirrors the Postgres down migration).
  await col.deleteMany({ turnId: { $exists: false } });
  await col.deleteMany({ turnId: null });

  // Unset the new fields.
  await col.updateMany({}, { $unset: { processedAt: "", status: "" } });
}
