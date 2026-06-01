// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: ReplaceFileUrlWithFileRelationInAgentMessagePart1772555830171
//
// Postgres DDL intent (on core.agentMessagePart):
//   - Dropped column `fileUrl`      (varchar, nullable)
//   - Dropped column `fileMediaType` (varchar, nullable)
//   - Added column  `fileId`        (uuid, nullable, FK → core.file(id) ON DELETE RESTRICT)
//
// MongoDB equivalent:
//   - Remove `fileUrl` and `fileMediaType` fields from existing documents in
//     `sabcrm_agentMessagePart`.
//   - The `fileId` field (string uuid reference to sabcrm_file) can simply be
//     absent on existing documents (treated as null).
//   - No index is required (nullable reference, no uniqueness constraint).

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

export const MIGRATION_NAME =
  "ReplaceFileUrlWithFileRelationInAgentMessagePart1772555830171";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_agentMessagePart")
    .updateMany(
      { $or: [{ fileUrl: { $exists: true } }, { fileMediaType: { $exists: true } }] },
      { $unset: { fileUrl: "", fileMediaType: "" } },
    );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  // Restore fileUrl/fileMediaType as null for documents that have fileId
  await db
    .collection("sabcrm_agentMessagePart")
    .updateMany(
      { fileId: { $exists: true } },
      { $unset: { fileId: "" }, $set: { fileUrl: null, fileMediaType: null } },
    );
}
