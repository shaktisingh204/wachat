// PORT-NOTE: pg-migration->mongo-index/seed
// Original Twenty migration: makeWebhookUniversalIdentifierAndApplicationIdNotNull
// PostgreSQL DDL (ALTER TABLE core.webhook) has no direct Mongo analogue for NOT NULL
// constraints or FK constraints. In MongoDB, enforcement is done at the application layer.
//
// Original Postgres operations:
//   - DROP FK "FK_e755f49a9ef74b36e27932f7a6c" on webhook.applicationId
//   - DROP INDEX "IDX_d48d713d01cc3c81bad1f39795"
//   - ALTER webhook.universalIdentifier SET NOT NULL
//   - ALTER webhook.applicationId SET NOT NULL
//   - CREATE UNIQUE INDEX "IDX_d48d713d01cc3c81bad1f39795" ON webhook (workspaceId, universalIdentifier)
//   - ADD FK webhook.applicationId -> application(id) ON DELETE CASCADE
//
// Mongo equivalent:
//   - Ensure { workspaceId: 1, universalIdentifier: 1 } unique index on sabcrm_webhook

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * Ensures the Mongo equivalent of the webhook uniqueness constraint:
 * a unique compound index on (workspaceId, universalIdentifier).
 */
export async function ensureWebhookIndexes(): Promise<void> {
  const db = await connectToDatabase();
  const col = db.collection("sabcrm_webhook");

  await col.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    { unique: true, sparse: false, name: "IDX_webhook_workspaceId_universalIdentifier" }
  );
}
