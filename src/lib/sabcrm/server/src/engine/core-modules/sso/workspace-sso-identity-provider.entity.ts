import 'server-only';

// PORT-NOTE: TypeORM @Entity (Postgres) → Mongo collection module.
// Collection: sabcrm_workspacesssoidentityprovider
// Enums are preserved verbatim; TypeORM decorators are dropped.

import { type Collection } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';

// ── Enums ────────────────────────────────────────────────────────────────────

export enum IdentityProviderType {
  OIDC = 'OIDC',
  SAML = 'SAML',
}

export enum OIDCResponseType {
  // Only Authorization Code is used for now
  CODE = 'code',
  ID_TOKEN = 'id_token',
  TOKEN = 'token',
  NONE = 'none',
}

export enum SSOIdentityProviderStatus {
  Active = 'Active',
  Inactive = 'Inactive',
  Error = 'Error',
}

// ── Document type ─────────────────────────────────────────────────────────────

export type WorkspaceSSOIdentityProviderDocument = {
  /** MongoDB document id (string UUID kept for cross-service compat). */
  _id: string;
  id: string;

  name: string;
  status: SSOIdentityProviderStatus;
  createdAt: Date;
  updatedAt: Date;
  type: IdentityProviderType;
  issuer: string;

  // OIDC fields
  clientID?: string;
  clientSecret?: string;

  // SAML fields
  ssoURL?: string;
  certificate?: string;
  fingerprint?: string;
};

// ── Collection accessor ───────────────────────────────────────────────────────

const COLLECTION_NAME = 'sabcrm_workspacesssoidentityprovider';

export async function getWorkspaceSSOIdentityProviderCollection(): Promise<
  Collection<WorkspaceSSOIdentityProviderDocument>
> {
  const { db } = await connectToDatabase();
  return db.collection<WorkspaceSSOIdentityProviderDocument>(COLLECTION_NAME);
}
