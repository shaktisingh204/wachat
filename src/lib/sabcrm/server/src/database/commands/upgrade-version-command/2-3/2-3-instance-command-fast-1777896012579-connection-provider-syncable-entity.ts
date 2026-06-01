import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: FastInstanceCommand — creates connectionProvider table and alters
// connectedAccount in Postgres. In Mongo we create the sabcrm_connectionProvider
// collection with the equivalent indexes, and add the new fields to
// sabcrm_connectedAccount documents.
// Version: 2.3.0  Timestamp: 1777896012579

export interface ConnectionProviderSyncableEntityMigration {
  version: "2.3.0";
  timestamp: 1777896012579;
  type: "fast";
  description: "Create connectionProvider collection and add connectionProviderId/applicationId/name/visibility to connectedAccount";
}

export type ConnectionProviderDocument = {
  _id?: unknown;
  workspaceId: string;
  applicationId: string;
  universalIdentifier: string;
  name: string;
  displayName: string;
  type: string;
  oauthConfig?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Mongo analogue for connectionProvider creation + connectedAccount alteration.
 *
 * Indexes created on sabcrm_connectionProvider:
 *   - unique { name, applicationId }
 *   - { applicationId }
 *   - unique { workspaceId, universalIdentifier }
 *
 * Fields added to sabcrm_connectedAccount:
 *   connectionProviderId?: string
 *   applicationId?: string
 *   name?: string
 *   visibility: string (default 'user')
 */
export async function up(): Promise<void> {
  const { db } = await connectToDatabase();

  // Create the connectionProvider collection and its indexes.
  const connectionProviders = db.collection("sabcrm_connectionProvider");

  await connectionProviders.createIndex(
    { name: 1, applicationId: 1 },
    { unique: true, name: "IDX_CONNECTION_PROVIDER_NAME_APPLICATION_UNIQUE" },
  );

  await connectionProviders.createIndex(
    { applicationId: 1 },
    { name: "IDX_CONNECTION_PROVIDER_APPLICATION_ID" },
  );

  await connectionProviders.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    { unique: true, name: "IDX_44a4fc17a91603c38daabfd4d8" },
  );

  // Add new fields to existing connectedAccount documents (visibility defaults to 'user').
  const connectedAccounts = db.collection("sabcrm_connectedAccount");

  await connectedAccounts.updateMany(
    { visibility: { $exists: false } },
    {
      $set: { visibility: "user" },
    },
  );

  await connectedAccounts.createIndex(
    { connectionProviderId: 1 },
    { name: "IDX_CONNECTED_ACCOUNT_CONNECTION_PROVIDER_ID", sparse: true },
  );

  await connectedAccounts.createIndex(
    { applicationId: 1 },
    { name: "IDX_CONNECTED_ACCOUNT_APPLICATION_ID", sparse: true },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();

  const connectedAccounts = db.collection("sabcrm_connectedAccount");
  await connectedAccounts.dropIndex("IDX_CONNECTED_ACCOUNT_APPLICATION_ID");
  await connectedAccounts.dropIndex("IDX_CONNECTED_ACCOUNT_CONNECTION_PROVIDER_ID");
  await connectedAccounts.updateMany(
    {},
    {
      $unset: {
        connectionProviderId: "",
        applicationId: "",
        name: "",
        visibility: "",
      },
    },
  );

  // Drop connectionProvider collection entirely.
  await db.collection("sabcrm_connectionProvider").drop();
}
