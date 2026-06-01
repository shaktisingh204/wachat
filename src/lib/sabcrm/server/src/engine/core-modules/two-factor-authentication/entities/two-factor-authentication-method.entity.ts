import "server-only";

// PORT-NOTE: entity->mongo-schema — TypeORM @Entity (Postgres) converted to a
// typed MongoDB document type + typed collection accessor.
// Original table: twoFactorAuthenticationMethod (schema: core).
// Unique index on [userWorkspaceId, strategy] is declared below.
// Check constraint on secret format (enc:v2:…) cannot be enforced in Mongo;
// documented here for reference — enforce at application layer.

import { type Collection, type ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';

// TwoFactorAuthenticationStrategy mirrors the twenty-shared enum.
export enum TwoFactorAuthenticationStrategy {
  TOTP = 'TOTP',
}

export enum OTPStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
}

// Branded type alias — the secret is always stored encrypted (enc:v2:…).
export type EncryptedString = string & { readonly __brand: 'EncryptedString' };

export type TwoFactorAuthenticationMethodDocument = {
  _id?: ObjectId;
  /** UUID primary key (mirrored from Postgres PK for cross-service compatibility) */
  id: string;
  /** FK → workspace */
  workspaceId: string;
  /** FK → userWorkspace */
  userWorkspaceId: string;
  /** Encrypted TOTP secret; format: enc:v2:<ciphertext> */
  secret: EncryptedString;
  status: OTPStatus;
  strategy: TwoFactorAuthenticationStrategy;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

const COLLECTION_NAME = 'sabcrm_two_factor_authentication_method';

export async function getTwoFactorAuthenticationMethodCollection(): Promise<
  Collection<TwoFactorAuthenticationMethodDocument>
> {
  const db = await connectToDatabase();
  const collection = db.collection<TwoFactorAuthenticationMethodDocument>(COLLECTION_NAME);

  // Unique index mirrors the TypeORM @Index on [userWorkspaceId, strategy].
  await collection.createIndex(
    { userWorkspaceId: 1, strategy: 1 },
    { unique: true, name: 'uniq_userWorkspace_strategy', background: true },
  );

  // Index on workspaceId for workspace-scoped queries.
  await collection.createIndex(
    { workspaceId: 1 },
    { name: 'idx_workspaceId', background: true },
  );

  return collection;
}
