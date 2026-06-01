// PORT-NOTE: pg-migration->mongo-index/seed
// Original: creates three new Postgres tables with foreign keys:
//   • "core"."connectedAccount"
//   • "core"."messageChannel"
//   • "core"."messageFolder"
//   • "core"."calendarChannel"
//
// Mongo equivalent: create the corresponding collections with their indexes.
// Foreign-key constraints become reference-field indexes.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/** Creates Mongo collections + indexes for messaging infrastructure entities. */
export async function applyMigration1773945207801(): Promise<void> {
  const { db } = await connectToDatabase();

  // ── connectedAccount ─────────────────────────────────────────────────────
  const connectedAccount = db.collection("sabcrm_connectedAccount");
  await connectedAccount.createIndex(
    { workspaceId: 1 },
    { background: true, name: "idx_connectedAccount_workspaceId" },
  );
  await connectedAccount.createIndex(
    { userWorkspaceId: 1 },
    { background: true, name: "idx_connectedAccount_userWorkspaceId" },
  );

  // ── messageChannel ────────────────────────────────────────────────────────
  const messageChannel = db.collection("sabcrm_messageChannel");
  await messageChannel.createIndex(
    { workspaceId: 1 },
    { background: true, name: "idx_messageChannel_workspaceId" },
  );
  await messageChannel.createIndex(
    { connectedAccountId: 1 },
    { background: true, name: "idx_messageChannel_connectedAccountId" },
  );

  // ── messageFolder ─────────────────────────────────────────────────────────
  const messageFolder = db.collection("sabcrm_messageFolder");
  await messageFolder.createIndex(
    { workspaceId: 1 },
    { background: true, name: "idx_messageFolder_workspaceId" },
  );
  await messageFolder.createIndex(
    { messageChannelId: 1 },
    { background: true, name: "idx_messageFolder_messageChannelId" },
  );

  // ── calendarChannel ───────────────────────────────────────────────────────
  const calendarChannel = db.collection("sabcrm_calendarChannel");
  await calendarChannel.createIndex(
    { workspaceId: 1 },
    { background: true, name: "idx_calendarChannel_workspaceId" },
  );
  await calendarChannel.createIndex(
    { connectedAccountId: 1 },
    { background: true, name: "idx_calendarChannel_connectedAccountId" },
  );
}

/** Reversal: drop the four collections created by this migration. */
export async function rollbackMigration1773945207801(): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection("sabcrm_calendarChannel").drop().catch(() => undefined);
  await db.collection("sabcrm_messageFolder").drop().catch(() => undefined);
  await db.collection("sabcrm_messageChannel").drop().catch(() => undefined);
  await db
    .collection("sabcrm_connectedAccount")
    .drop()
    .catch(() => undefined);
}
