import "server-only";

import { MongoClient, type Collection } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { WorkspaceActivationStatus } from "@/lib/sabcrm/shared/workspace/workspace-activation-status.enum";

// ---------------------------------------------------------------------------
// Embedded / referenced sub-document shapes
// ---------------------------------------------------------------------------

/** Minimal shape for SSO identity providers stored as an array on the workspace. */
export type WorkspaceSSOIdentityProviderRef = {
  id: string;
  name: string;
  type: string;
  status: string;
  issuer: string;
};

// ---------------------------------------------------------------------------
// Main document type
// ---------------------------------------------------------------------------

export type WorkspaceDocument = {
  _id?: import("mongodb").ObjectId;
  /** UUID primary key (mirrors Postgres uuid). */
  id: string;

  // --- display ---
  displayName?: string;
  /** @deprecated use logoFileId */
  logo?: string;
  logoFileId: string | null;

  // --- access ---
  inviteHash?: string;
  allowImpersonation: boolean;
  isPublicInviteLinkEnabled: boolean;

  // --- timestamps ---
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  suspendedAt: Date | null;

  // --- retention ---
  trashRetentionDays: number;
  eventLogRetentionDays: number;

  // --- activation ---
  activationStatus: WorkspaceActivationStatus;

  // --- domains ---
  subdomain: string;
  customDomain: string | null;
  isCustomDomainEnabled: boolean;

  // --- auth providers ---
  isGoogleAuthEnabled: boolean;
  isGoogleAuthBypassEnabled: boolean;
  isTwoFactorAuthenticationEnforced: boolean;
  isPasswordAuthEnabled: boolean;
  isPasswordAuthBypassEnabled: boolean;
  isMicrosoftAuthEnabled: boolean;
  isMicrosoftAuthBypassEnabled: boolean;

  // --- messaging ---
  isInternalMessagesImportEnabled: boolean;

  // --- profile ---
  editableProfileFields: string[] | null;

  // --- roles ---
  defaultRoleId: string | null;

  // --- AI models ---
  fastModel: string;
  smartModel: string;
  /** @deprecated */
  routerModel: string;
  aiAdditionalInstructions: string | null;
  enabledAiModelIds: string[];
  useRecommendedModels: boolean;

  // --- application ---
  workspaceCustomApplicationId: string;

  // --- schema versioning ---
  metadataVersion: number;
  databaseSchema: string | null;

  // --- relations (stored as id arrays / embedded refs) ---
  /** Refs to AppToken documents (sabcrm_app_tokens collection). */
  appTokenIds: string[];
  /** Refs to KeyValuePair documents. */
  keyValuePairIds: string[];
  /** Refs to UserWorkspace documents. */
  workspaceUserIds: string[];
  /** Refs to FeatureFlag documents. */
  featureFlagIds: string[];
  /** Refs to ApprovedAccessDomain documents. */
  approvedAccessDomainIds: string[];
  /** Refs to EmailingDomain documents. */
  emailingDomainIds: string[];
  /** Refs to PublicDomain documents. */
  publicDomainIds: string[];
  /** Embedded SSO providers (small list, safe to embed). */
  workspaceSSOIdentityProviders: WorkspaceSSOIdentityProviderRef[];
  /** Refs to Agent documents. */
  agentIds: string[];
  /** Refs to Webhook documents. */
  webhookIds: string[];
  /** Refs to ApiKey documents. */
  apiKeyIds: string[];
  /** Refs to View documents. */
  viewIds: string[];
  /** Refs to ViewField documents. */
  viewFieldIds: string[];
  /** Refs to ViewFilter documents. */
  viewFilterIds: string[];
  /** Refs to ViewFilterGroup documents. */
  viewFilterGroupIds: string[];
  /** Refs to ViewGroup documents. */
  viewGroupIds: string[];
  /** Refs to ViewSort documents. */
  viewSortIds: string[];
  /** Refs to Application documents. */
  applicationIds: string[];

  // --- computed (not stored, resolved at query time) ---
  workspaceMembersCount?: number;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const WORKSPACE_DOCUMENT_DEFAULTS: Omit<
  WorkspaceDocument,
  "id" | "subdomain" | "workspaceCustomApplicationId"
> = {
  displayName: undefined,
  logo: undefined,
  logoFileId: null,
  inviteHash: undefined,
  allowImpersonation: true,
  isPublicInviteLinkEnabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  suspendedAt: null,
  trashRetentionDays: 14,
  eventLogRetentionDays: 90,
  activationStatus: WorkspaceActivationStatus.INACTIVE,
  customDomain: null,
  isCustomDomainEnabled: false,
  isGoogleAuthEnabled: true,
  isGoogleAuthBypassEnabled: false,
  isTwoFactorAuthenticationEnforced: false,
  isPasswordAuthEnabled: true,
  isPasswordAuthBypassEnabled: false,
  isMicrosoftAuthEnabled: true,
  isMicrosoftAuthBypassEnabled: false,
  isInternalMessagesImportEnabled: false,
  editableProfileFields: ["email", "profilePicture", "firstName", "lastName"],
  defaultRoleId: null,
  fastModel: "auto-select-fast",
  smartModel: "auto-select-smart",
  routerModel: "auto",
  aiAdditionalInstructions: null,
  enabledAiModelIds: [],
  useRecommendedModels: true,
  metadataVersion: 1,
  databaseSchema: null,
  appTokenIds: [],
  keyValuePairIds: [],
  workspaceUserIds: [],
  featureFlagIds: [],
  approvedAccessDomainIds: [],
  emailingDomainIds: [],
  publicDomainIds: [],
  workspaceSSOIdentityProviders: [],
  agentIds: [],
  webhookIds: [],
  apiKeyIds: [],
  viewIds: [],
  viewFieldIds: [],
  viewFilterIds: [],
  viewFilterGroupIds: [],
  viewGroupIds: [],
  viewSortIds: [],
  applicationIds: [],
};

// ---------------------------------------------------------------------------
// Collection accessor
// ---------------------------------------------------------------------------

const COLLECTION_NAME = "sabcrm_workspaces";

export function getWorkspaceCollection(
  client: MongoClient,
): Collection<WorkspaceDocument> {
  return client.db().collection<WorkspaceDocument>(COLLECTION_NAME);
}

export async function getWorkspaceCollectionAsync(): Promise<
  Collection<WorkspaceDocument>
> {
  const client = await connectToDatabase();
  return getWorkspaceCollection(client);
}

// ---------------------------------------------------------------------------
// Indexes (run once at startup / migration time)
// ---------------------------------------------------------------------------

export async function ensureWorkspaceIndexes() {
  const collection = await getWorkspaceCollectionAsync();
  await Promise.all([
    collection.createIndex({ id: 1 }, { unique: true }),
    collection.createIndex({ subdomain: 1 }, { unique: true }),
    collection.createIndex({ customDomain: 1 }, { unique: true, sparse: true }),
    collection.createIndex({ activationStatus: 1 }),
    collection.createIndex({ deletedAt: 1 }),
  ]);
}
