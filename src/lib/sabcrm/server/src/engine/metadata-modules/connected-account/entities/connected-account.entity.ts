import 'server-only';

import { type Collection, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';

// PORT-NOTE: Ported from TypeORM ConnectedAccountEntity (Postgres, schema: core).
// Mongo collection name: sabcrm_connected_account
// Postgres index IDX_CONNECTED_ACCOUNT_CONNECTION_PROVIDER_ID → Mongo index on connectionProviderId
// Postgres index IDX_CONNECTED_ACCOUNT_APPLICATION_ID → Mongo index on applicationId
// CHECK constraints on encrypted token format are enforced at application layer by ConnectedAccountTokenEncryptionService.

export type ConnectedAccountVisibility = 'user' | 'workspace';

// Branded string types (preserved for type safety; actual encryption enforcement is in the service layer)
export type EncryptedString = string & { __brand: 'EncryptedString' };
export type PlaintextString = string & { __brand: 'PlaintextString' };

export type EncryptedConnectionParameters = {
  host: string;
  port: number;
  username?: string;
  secure?: boolean;
  password: EncryptedString;
};

export type EncryptedImapSmtpCaldavParams = {
  IMAP?: EncryptedConnectionParameters;
  SMTP?: EncryptedConnectionParameters;
  CALDAV?: EncryptedConnectionParameters;
};

export type ConnectedAccountDocument = {
  /** Application-level UUID (mirrors the Postgres id column) */
  id: string;
  handle: string;
  provider: string;
  accessToken: EncryptedString | null;
  refreshToken: EncryptedString | null;
  lastCredentialsRefreshedAt: Date | null;
  authFailedAt: Date | null;
  handleAliases: string[] | null;
  scopes: string[] | null;
  connectionParameters: EncryptedImapSmtpCaldavParams | null;
  lastSignedInAt: Date | null;
  oidcTokenClaims: Record<string, unknown> | null;
  userWorkspaceId: string;
  connectionProviderId: string | null;
  applicationId: string | null;
  name: string | null;
  /** 'user' = private to connecting user, 'workspace' = shared with all members */
  visibility: ConnectedAccountVisibility;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;

  // Relation metadata (id refs only — no embedded documents)
  // messageChannelIds: string[]  — resolved via sabcrm_message_channel.connectedAccountId
  // calendarChannelIds: string[] — resolved via sabcrm_calendar_channel.connectedAccountId
};

const COLLECTION_NAME = 'sabcrm_connected_account';

export async function getConnectedAccountCollection(): Promise<
  Collection<ConnectedAccountDocument>
> {
  const { db } = await connectToDatabase();
  return db.collection<ConnectedAccountDocument>(COLLECTION_NAME);
}

export async function ensureConnectedAccountIndexes(): Promise<void> {
  const col = await getConnectedAccountCollection();
  await Promise.all([
    col.createIndex({ connectionProviderId: 1 }, { sparse: true, name: 'IDX_CONNECTED_ACCOUNT_CONNECTION_PROVIDER_ID' }),
    col.createIndex({ applicationId: 1 }, { sparse: true, name: 'IDX_CONNECTED_ACCOUNT_APPLICATION_ID' }),
    col.createIndex({ workspaceId: 1, userWorkspaceId: 1 }),
    col.createIndex({ id: 1, workspaceId: 1 }, { unique: true }),
  ]);
}

// Type alias so other modules can use WithId<ConnectedAccountDocument>
export type ConnectedAccountDocumentWithId = WithId<ConnectedAccountDocument>;
