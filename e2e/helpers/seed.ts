/**
 * E2E Mongo seed helpers for SabFlow — direct-driver writes that mirror
 * the app's own document shapes:
 *
 *   - sabflows                    → src/app/actions/sabflow/index.ts createSabFlow
 *   - sabflow_env_vars            → src/lib/sabflow/envVars/db.ts
 *   - sabflow_folders             → src/lib/sabflow/folders/db.ts
 *   - sabflow_workspaces/_members/_invites
 *                                 → src/lib/sabflow/workspaces/db.ts
 *
 * Every seeded doc is tagged `__e2e: true` and name-prefixed `e2e-` so
 * `cleanup()` can sweep them. All docs are scoped to the fixture user
 * (TEST_USER_ID) from ./session.
 *
 * Credentials are intentionally NOT seeded here: credential `data` is
 * encrypted at rest by src/lib/sabflow/credentials/encryption.ts
 * (see encryptRecord in credentials/db.ts). Hand-writing docs would
 * produce values the engine cannot decrypt — create credentials through
 * the HTTP API (POST /api/sabflow/credentials) with the minted session
 * cookie instead.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { ObjectId, type Db } from 'mongodb';
import { TEST_USER_ID, TEST_USER_EMAIL } from './session';

export const E2E_PREFIX = 'e2e-';

const createId = () => randomUUID();

/* ── Flows (collection: sabflows) ───────────────────────────────────── */

export interface CreateFlowOptions {
  name?: string;
  status?: 'DRAFT' | 'PUBLISHED';
  /** SabFlowEvent[] — e.g. schedule events; defaults to []. */
  events?: Array<Record<string, unknown>>;
  /** NOTE: stores the folder NAME, not an id (see flows-by-folder route). */
  folderId?: string;
}

/**
 * Insert a minimal valid SabFlowDoc — same shape createSabFlow writes:
 * one Start group containing a single `text` block, no edges/events.
 * `userId` is a plain string (hex of the user's ObjectId) — that is how
 * the app stores it and how every query filters it.
 */
export async function createFlow(
  db: Db,
  opts: CreateFlowOptions = {},
): Promise<{ flowId: string; name: string }> {
  const startGroupId = createId();
  const startBlockId = createId();
  const name = opts.name ?? `${E2E_PREFIX}flow-${Date.now()}-${randomBytes(3).toString('hex')}`;
  const now = new Date();

  const doc = {
    userId: TEST_USER_ID,
    name,
    groups: [
      {
        id: startGroupId,
        title: 'Start',
        graphCoordinates: { x: 200, y: 200 },
        blocks: [
          {
            id: startBlockId,
            type: 'text',
            groupId: startGroupId,
            options: { content: 'Hi! This is the beginning of your flow.' },
          },
        ],
      },
    ],
    edges: [] as unknown[],
    events: opts.events ?? [],
    variables: [] as unknown[],
    theme: {},
    settings: {},
    status: opts.status ?? 'DRAFT',
    ...(opts.folderId ? { folderId: opts.folderId } : {}),
    createdAt: now,
    updatedAt: now,
    __e2e: true,
  };

  const res = await db.collection('sabflows').insertOne(doc);
  return { flowId: res.insertedId.toHexString(), name };
}

/**
 * PUBLISHED flow with one enabled `schedule` event — the exact shape
 * runScheduledTick (src/lib/sabflow/triggers/cron-tick.ts) scans for.
 */
export async function createScheduledFlow(
  db: Db,
  opts: { cronExpression?: string; enabled?: boolean; timezone?: string } = {},
): Promise<{ flowId: string; eventId: string; name: string }> {
  const eventId = createId();
  const { flowId, name } = await createFlow(db, {
    status: 'PUBLISHED',
    events: [
      {
        id: eventId,
        type: 'schedule',
        graphCoordinates: { x: 0, y: 0 },
        options: {
          cronExpression: opts.cronExpression ?? '* * * * *',
          enabled: opts.enabled ?? true,
          ...(opts.timezone ? { timezone: opts.timezone } : {}),
        },
      },
    ],
  });
  return { flowId, eventId, name };
}

/* ── Env vars (collection: sabflow_env_vars) ────────────────────────── */

/** Mirror of upsertEnvVar in src/lib/sabflow/envVars/db.ts. */
export async function createEnvVar(
  db: Db,
  key: string,
  value: string,
  isSecret = false,
): Promise<void> {
  const now = new Date();
  await db.collection('sabflow_env_vars').updateOne(
    { userId: TEST_USER_ID, key },
    {
      $set: { value, isSecret, updatedAt: now, __e2e: true },
      $setOnInsert: { userId: TEST_USER_ID, key },
    },
    { upsert: true },
  );
}

/* ── Folders (collection: sabflow_folders) ──────────────────────────── */

/** Mirror of FolderDoc in src/lib/sabflow/folders/db.ts. */
export async function createFolder(
  db: Db,
  name?: string,
): Promise<{ folderId: string; name: string }> {
  const folderName = name ?? `${E2E_PREFIX}folder-${randomBytes(3).toString('hex')}`;
  const now = new Date();
  const res = await db.collection('sabflow_folders').insertOne({
    userId: TEST_USER_ID,
    name: folderName,
    color: '#8b5cf6',
    createdAt: now,
    updatedAt: now,
    __e2e: true,
  });
  return { folderId: res.insertedId.toHexString(), name: folderName };
}

/* ── Workspaces + invites ───────────────────────────────────────────── */

/**
 * Workspace owned by the fixture user + its owner membership row —
 * mirrors WorkspaceDoc / WorkspaceMemberDoc in workspaces/db.ts.
 */
export async function createWorkspace(
  db: Db,
  name?: string,
): Promise<{ workspaceId: string; name: string }> {
  const wsName = name ?? `${E2E_PREFIX}ws-${randomBytes(3).toString('hex')}`;
  const now = new Date();
  const res = await db.collection('sabflow_workspaces').insertOne({
    name: wsName,
    slug: wsName.toLowerCase(),
    ownerId: TEST_USER_ID,
    createdAt: now,
    updatedAt: now,
    __e2e: true,
  });
  const workspaceId = res.insertedId.toHexString();
  await db.collection('sabflow_workspace_members').insertOne({
    workspaceId,
    userId: TEST_USER_ID,
    role: 'owner',
    joinedAt: now,
    __e2e: true,
  });
  return { workspaceId, name: wsName };
}

export interface CreateInviteOptions {
  /** Defaults to a fresh e2e workspace owned by the fixture user. */
  workspaceId?: string;
  /** Invitee email. Use TEST_USER_EMAIL to land in the user's inbox. */
  email?: string;
  role?: 'admin' | 'editor' | 'viewer';
  /** TTL; default 7 days (pending + non-expired is what the API lists). */
  ttlMs?: number;
}

/** Mirror of createInvite in src/lib/sabflow/workspaces/db.ts. */
export async function createWorkspaceInvite(
  db: Db,
  opts: CreateInviteOptions = {},
): Promise<{ inviteId: string; token: string; workspaceId: string; email: string }> {
  const workspaceId = opts.workspaceId ?? (await createWorkspace(db)).workspaceId;
  const email = (opts.email ?? `${E2E_PREFIX}invitee@test.local`).trim().toLowerCase();
  const now = new Date();
  const token = randomBytes(24).toString('hex');
  const res = await db.collection('sabflow_workspace_invites').insertOne({
    workspaceId,
    email,
    role: opts.role ?? 'editor',
    invitedBy: TEST_USER_ID,
    token,
    expiresAt: new Date(now.getTime() + (opts.ttlMs ?? 7 * 24 * 60 * 60 * 1000)),
    createdAt: now,
    __e2e: true,
  });
  return { inviteId: res.insertedId.toHexString(), token, workspaceId, email };
}

/* ── Cleanup ────────────────────────────────────────────────────────── */

/**
 * Delete everything this module (or a test run) seeded. Matches by the
 * `__e2e: true` tag OR the `e2e-` name prefix, always additionally scoped
 * to the fixture user so a stray tag on real data can't be swept.
 * The fixture user itself is kept (cheap, reused across runs).
 */
export async function cleanup(db: Db): Promise<void> {
  const tagged = { $or: [{ __e2e: true }, { name: { $regex: `^${E2E_PREFIX}` } }] };

  await Promise.all([
    db.collection('sabflows').deleteMany({ userId: TEST_USER_ID, ...tagged }),
    db.collection('sabflow_executions').deleteMany({ projectId: TEST_USER_ID }),
    db.collection('sabflow_env_vars').deleteMany({ userId: TEST_USER_ID }),
    db.collection('sabflow_folders').deleteMany({ userId: TEST_USER_ID, ...tagged }),
  ]);

  // Workspaces owned by the fixture user → then their members + invites.
  const wsIds = await db
    .collection('sabflow_workspaces')
    .find({ ownerId: TEST_USER_ID })
    .project({ _id: 1 })
    .toArray();
  const ids = wsIds.map((w) => (w._id as ObjectId).toHexString());
  if (ids.length > 0) {
    await Promise.all([
      db.collection('sabflow_workspace_members').deleteMany({ workspaceId: { $in: ids } }),
      db.collection('sabflow_workspace_invites').deleteMany({ workspaceId: { $in: ids } }),
      db.collection('sabflow_workspaces').deleteMany({ ownerId: TEST_USER_ID }),
    ]);
  }
  // Invites addressed TO the fixture user (seeded into other workspaces).
  await db
    .collection('sabflow_workspace_invites')
    .deleteMany({ email: TEST_USER_EMAIL, __e2e: true });
}
