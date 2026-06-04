import 'server-only';

/**
 * C6 — SabNode → Twenty identity bridge.
 *
 * Maps a SabNode (user, project) pair onto Twenty's (user, workspace, role) and
 * mints a scoped access token for the GraphQL client (C5). The central tenancy
 * rule: **one SabNode `project` = one Twenty `workspace`** (PLAN.md §4), with the
 * link persisted as `projects.twentyWorkspaceId` (Mongo). The Twenty user id is
 * resolved per-(project,user) and persisted on the same project document under
 * `projects.twentyUserMap[<sabnodeUserId>]`, so a stable workspaceMember backs
 * each bridged session.
 *
 * Token minting follows twenty-server's **legacy HS256 scheme** (see
 * `jwt-wrapper.service.ts`): the HMAC secret for an ACCESS token is
 * `sha256(APP_SECRET + workspaceId + 'ACCESS')` and the payload is an
 * `AccessTokenJwtPayload` (`sub`, `userId`, `workspaceId`, `userWorkspaceId`,
 * `type: 'ACCESS'`, `authProvider`). twenty-server's `extractAppSecretBody`
 * prefers `workspaceId` over `userId`, so workspace-scoped tokens verify against
 * the workspace-derived secret. No DB-backed signing key is required for the
 * legacy path, which keeps the bridge stateless on the Twenty side.
 *
 * GATING: this code only runs when `CRM_DATA_LAYER === 'twenty'`. The data-layer
 * router (C8) keeps the Rust path as the default, so wiring this in does not
 * change default behaviour. When `CRM_DATA_LAYER` is not `twenty`, callers fail
 * loudly with {@link TwentyBridgeNotConfiguredError} rather than silently
 * minting tokens against an unconfigured Twenty server.
 */

import { createHash } from 'crypto';
import { ObjectId } from 'mongodb';
import * as jwt from 'jsonwebtoken';

import { connectToDatabase } from '@/lib/mongodb';
import { getEffectivePermissionsForProject } from '@/lib/rbac-server';
import { permissionsToTwentyRole, type TwentyRole } from './twenty-rbac-bridge';

export interface TwentyBridge {
  twentyWorkspaceId: string;
  twentyUserId: string;
  twentyRole: TwentyRole;
  /** Short-lived bearer token scoped to the workspace + user. */
  token: string;
}

export class TwentyBridgeNotConfiguredError extends Error {
  constructor(message = 'Twenty user bridge is not configured.') {
    super(message);
    this.name = 'TwentyBridgeNotConfiguredError';
  }
}

/** twenty-server's legacy (HS256) JWT scheme. Mirrors jwt-algorithm.constant.ts. */
const JWT_LEGACY_ALGORITHM = 'HS256' as const;

/** Mirrors twenty-server JwtTokenTypeEnum.ACCESS. */
const JWT_TOKEN_TYPE_ACCESS = 'ACCESS' as const;

/** Mirrors twenty-server AuthProviderEnum.Password — our bridged sessions are app-internal. */
const AUTH_PROVIDER_PASSWORD = 'password' as const;

/** Default access-token lifetime, matching twenty-server's ACCESS_TOKEN_EXPIRES_IN default. */
const DEFAULT_TOKEN_EXPIRES_IN = '30m';

/**
 * Derive twenty-server's legacy app secret for a given token type + body key.
 * Must stay byte-identical to `JwtWrapperService.generateAppSecret`.
 */
function generateAppSecret(appSecret: string, appSecretBody: string, type: string): string {
  return createHash('sha256')
    .update(`${appSecret}${appSecretBody}${type}`)
    .digest('hex');
}

/**
 * Generate a deterministic v4-shaped UUID seeded from `namespace`. Twenty stores
 * workspace / user ids as UUIDs; deriving them deterministically keeps the
 * SabNode↔Twenty mapping reproducible even before the first persisted row, and
 * the value is persisted on first use so subsequent calls are stable.
 */
function deterministicUuid(namespace: string): string {
  const hex = createHash('sha256').update(namespace).digest('hex');
  // Lay out 32 hex chars into UUID form and stamp version (4) + variant (8-b).
  const bytes = hex.slice(0, 32).split('');
  bytes[12] = '4';
  const variantNibble = (parseInt(hex[16], 16) & 0x3) | 0x8;
  bytes[16] = variantNibble.toString(16);
  const s = bytes.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

function isTwentyDataLayerActive(): boolean {
  return process.env.CRM_DATA_LAYER === 'twenty';
}

function getAppSecretOrThrow(): string {
  // twenty-server reads APP_SECRET from TwentyConfigService; we read the same
  // var from the environment. Accept TWENTY_APP_SECRET as an explicit override.
  const secret = process.env.TWENTY_APP_SECRET || process.env.APP_SECRET;
  if (!secret) {
    throw new TwentyBridgeNotConfiguredError(
      'APP_SECRET (or TWENTY_APP_SECRET) is not set; cannot mint Twenty tokens.',
    );
  }
  return secret;
}

/**
 * Resolve (and persist on first use) the Twenty workspace id for a project and
 * the Twenty user id for this (project, user) pair. The mapping lives on the
 * `projects` document: `twentyWorkspaceId` + `twentyUserMap.<userId>`.
 */
async function resolveTwentyIdentity(
  userId: string,
  projectId: string,
): Promise<{ twentyWorkspaceId: string; twentyUserId: string }> {
  if (!ObjectId.isValid(projectId)) {
    throw new TwentyBridgeNotConfiguredError(
      `Cannot bridge: "${projectId}" is not a valid project id.`,
    );
  }

  const { db } = await connectToDatabase();
  const projects = db.collection('projects');
  const _id = new ObjectId(projectId);

  const project = await projects.findOne(
    { _id },
    { projection: { twentyWorkspaceId: 1, twentyUserMap: 1 } },
  );
  if (!project) {
    throw new TwentyBridgeNotConfiguredError(
      `Cannot bridge: project "${projectId}" not found.`,
    );
  }

  const existingWorkspaceId =
    typeof project.twentyWorkspaceId === 'string' ? project.twentyWorkspaceId : undefined;
  const twentyWorkspaceId = existingWorkspaceId ?? deterministicUuid(`workspace:${projectId}`);

  const userMap: Record<string, unknown> =
    project.twentyUserMap && typeof project.twentyUserMap === 'object'
      ? (project.twentyUserMap as Record<string, unknown>)
      : {};
  const existingUserId =
    typeof userMap[userId] === 'string' ? (userMap[userId] as string) : undefined;
  const twentyUserId =
    existingUserId ?? deterministicUuid(`user:${projectId}:${userId}`);

  // Persist only what is newly resolved, so the mapping is stable across calls.
  const set: Record<string, unknown> = {};
  if (!existingWorkspaceId) set.twentyWorkspaceId = twentyWorkspaceId;
  if (!existingUserId) set[`twentyUserMap.${userId}`] = twentyUserId;
  if (Object.keys(set).length > 0) {
    await projects.updateOne({ _id }, { $set: set });
  }

  return { twentyWorkspaceId, twentyUserId };
}

/**
 * Mint a workspace-scoped ACCESS token using twenty-server's legacy HS256 scheme.
 * The userWorkspaceId is derived deterministically from (workspace, user) — it
 * scopes the membership row twenty-server expects on an ACCESS payload.
 */
function mintAccessToken(args: {
  appSecret: string;
  twentyWorkspaceId: string;
  twentyUserId: string;
}): string {
  const { appSecret, twentyWorkspaceId, twentyUserId } = args;
  const secret = generateAppSecret(appSecret, twentyWorkspaceId, JWT_TOKEN_TYPE_ACCESS);
  const userWorkspaceId = deterministicUuid(
    `userWorkspace:${twentyWorkspaceId}:${twentyUserId}`,
  );

  const payload = {
    sub: twentyUserId,
    userId: twentyUserId,
    workspaceId: twentyWorkspaceId,
    userWorkspaceId,
    type: JWT_TOKEN_TYPE_ACCESS,
    authProvider: AUTH_PROVIDER_PASSWORD,
    isImpersonating: false,
  };

  const expiresIn = process.env.TWENTY_ACCESS_TOKEN_EXPIRES_IN || DEFAULT_TOKEN_EXPIRES_IN;

  return jwt.sign(payload, secret, {
    algorithm: JWT_LEGACY_ALGORITHM,
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Resolve the Twenty identity for a SabNode user acting in a project and mint a
 * scoped bearer token for the C5 GraphQL client.
 *
 * @throws {TwentyBridgeNotConfiguredError} when the Twenty data layer is not
 *   active, APP_SECRET is missing, or the project cannot be resolved.
 */
export async function bridgeUserToTwenty(
  userId: string,
  projectId: string,
): Promise<TwentyBridge> {
  if (!isTwentyDataLayerActive()) {
    throw new TwentyBridgeNotConfiguredError(
      'Twenty data layer is not active (CRM_DATA_LAYER !== "twenty").',
    );
  }

  const appSecret = getAppSecretOrThrow();

  const { twentyWorkspaceId, twentyUserId } = await resolveTwentyIdentity(userId, projectId);

  // Compute the bridged role from SabNode's resolved permissions (C7).
  const perms = await getEffectivePermissionsForProject(projectId);
  const twentyRole = permissionsToTwentyRole(perms);

  const token = mintAccessToken({ appSecret, twentyWorkspaceId, twentyUserId });

  return { twentyWorkspaceId, twentyUserId, twentyRole, token };
}
