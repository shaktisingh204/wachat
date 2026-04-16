/**
 * MongoDB helpers for SabFlow workspace / team management.
 *
 * Collections used (created on first write):
 *   - sabflow_workspaces
 *   - sabflow_workspace_members
 *   - sabflow_workspace_invites
 */

import 'server-only';
import { randomBytes } from 'crypto';
import { ObjectId } from 'mongodb';
import type { Collection } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type {
  AddWorkspaceMemberInput,
  CreateInviteInput,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  Workspace,
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceRole,
} from './types';

/* ── Raw Mongo doc shapes ─────────────────────────────────── */

interface WorkspaceDoc {
  _id: ObjectId;
  name: string;
  slug: string;
  ownerId: string;
  iconUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  plan?: 'free' | 'starter' | 'pro' | 'enterprise';
}

interface WorkspaceMemberDoc {
  _id: ObjectId;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  invitedBy?: string;
  joinedAt: Date;
}

interface WorkspaceInviteDoc {
  _id: ObjectId;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedBy: string;
  token: string;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
}

interface UserLookupDoc {
  _id: ObjectId;
  email?: string;
  name?: string;
}

/* ── Collection accessors ─────────────────────────────────── */

let indexesEnsured = false;

async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const { db } = await connectToDatabase();

  await Promise.all([
    db
      .collection('sabflow_workspaces')
      .createIndex({ slug: 1 }, { unique: true, background: true }),
    db
      .collection('sabflow_workspaces')
      .createIndex({ ownerId: 1 }, { background: true }),
    db
      .collection('sabflow_workspace_members')
      .createIndex(
        { workspaceId: 1, userId: 1 },
        { unique: true, background: true },
      ),
    db
      .collection('sabflow_workspace_members')
      .createIndex({ userId: 1 }, { background: true }),
    db
      .collection('sabflow_workspace_invites')
      .createIndex({ token: 1 }, { unique: true, background: true }),
    db
      .collection('sabflow_workspace_invites')
      .createIndex({ workspaceId: 1 }, { background: true }),
  ]);

  indexesEnsured = true;
}

async function getWorkspaceCollection(): Promise<Collection<WorkspaceDoc>> {
  await ensureIndexes();
  const { db } = await connectToDatabase();
  return db.collection<WorkspaceDoc>('sabflow_workspaces');
}

async function getMemberCollection(): Promise<Collection<WorkspaceMemberDoc>> {
  await ensureIndexes();
  const { db } = await connectToDatabase();
  return db.collection<WorkspaceMemberDoc>('sabflow_workspace_members');
}

async function getInviteCollection(): Promise<Collection<WorkspaceInviteDoc>> {
  await ensureIndexes();
  const { db } = await connectToDatabase();
  return db.collection<WorkspaceInviteDoc>('sabflow_workspace_invites');
}

/* ── Utilities ────────────────────────────────────────────── */

const SLUG_CHARS = /[^a-z0-9-]+/g;
const MULTI_DASH = /-{2,}/g;
const EDGE_DASH = /^-+|-+$/g;

export function toSlug(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(SLUG_CHARS, '')
    .replace(MULTI_DASH, '-')
    .replace(EDGE_DASH, '');
  return base || 'workspace';
}

/** Resolve a unique slug by appending `-2`, `-3`, … on conflict. */
async function uniqueSlug(base: string): Promise<string> {
  const col = await getWorkspaceCollection();
  const root = toSlug(base);
  let candidate = root;
  let n = 2;
  while (await col.findOne({ slug: candidate }, { projection: { _id: 1 } })) {
    candidate = `${root}-${n}`;
    n += 1;
  }
  return candidate;
}

function mapWorkspace(doc: WorkspaceDoc, memberCount?: number): Workspace {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    slug: doc.slug,
    ownerId: doc.ownerId,
    iconUrl: doc.iconUrl,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    plan: doc.plan,
    memberCount,
  };
}

function mapMember(
  doc: WorkspaceMemberDoc,
  user?: UserLookupDoc,
): WorkspaceMember {
  return {
    id: doc._id.toHexString(),
    workspaceId: doc.workspaceId,
    userId: doc.userId,
    role: doc.role,
    invitedBy: doc.invitedBy,
    joinedAt: doc.joinedAt,
    email: user?.email,
    name: user?.name,
  };
}

function mapInvite(doc: WorkspaceInviteDoc): WorkspaceInvite {
  return {
    id: doc._id.toHexString(),
    workspaceId: doc.workspaceId,
    email: doc.email,
    role: doc.role,
    invitedBy: doc.invitedBy,
    token: doc.token,
    expiresAt: doc.expiresAt,
    acceptedAt: doc.acceptedAt,
    createdAt: doc.createdAt,
  };
}

function newToken(): string {
  return randomBytes(32).toString('hex');
}

/* ══════════════════════════════════════════════════════════
   Workspace CRUD
   ══════════════════════════════════════════════════════════ */

export async function createWorkspace(
  input: CreateWorkspaceInput,
): Promise<Workspace> {
  const col = await getWorkspaceCollection();
  const memberCol = await getMemberCollection();

  const slug = await uniqueSlug(input.slug?.trim() || input.name);
  const now = new Date();

  const doc: WorkspaceDoc = {
    _id: new ObjectId(),
    name: input.name.trim() || 'Untitled workspace',
    slug,
    ownerId: input.ownerId,
    iconUrl: input.iconUrl,
    createdAt: now,
    updatedAt: now,
    plan: input.plan ?? 'free',
  };

  await col.insertOne(doc);

  // Owner is also a member with role = 'owner'.
  await memberCol.insertOne({
    _id: new ObjectId(),
    workspaceId: doc._id.toHexString(),
    userId: input.ownerId,
    role: 'owner',
    joinedAt: now,
  });

  return mapWorkspace(doc, 1);
}

export async function getWorkspacesByUser(
  userId: string,
): Promise<Workspace[]> {
  const memberCol = await getMemberCollection();
  const wsCol = await getWorkspaceCollection();

  const memberships = await memberCol
    .find({ userId }, { projection: { workspaceId: 1 } })
    .toArray();

  const ids = memberships
    .map((m) => m.workspaceId)
    .filter((id): id is string => typeof id === 'string' && ObjectId.isValid(id))
    .map((id) => new ObjectId(id));

  if (ids.length === 0) return [];

  const docs = await wsCol
    .find({ _id: { $in: ids } })
    .sort({ updatedAt: -1 })
    .toArray();

  // Member counts in one aggregation to avoid N queries.
  const counts = await memberCol
    .aggregate<{ _id: string; count: number }>([
      { $match: { workspaceId: { $in: docs.map((d) => d._id.toHexString()) } } },
      { $group: { _id: '$workspaceId', count: { $sum: 1 } } },
    ])
    .toArray();
  const countMap = new Map(counts.map((c) => [c._id, c.count]));

  return docs.map((d) => mapWorkspace(d, countMap.get(d._id.toHexString()) ?? 0));
}

export async function getWorkspaceById(id: string): Promise<Workspace | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await getWorkspaceCollection();
  const memberCol = await getMemberCollection();

  const doc = await col.findOne({ _id: new ObjectId(id) });
  if (!doc) return null;

  const memberCount = await memberCol.countDocuments({
    workspaceId: doc._id.toHexString(),
  });
  return mapWorkspace(doc, memberCount);
}

export async function getWorkspaceBySlug(
  slug: string,
): Promise<Workspace | null> {
  const col = await getWorkspaceCollection();
  const memberCol = await getMemberCollection();

  const doc = await col.findOne({ slug });
  if (!doc) return null;

  const memberCount = await memberCol.countDocuments({
    workspaceId: doc._id.toHexString(),
  });
  return mapWorkspace(doc, memberCount);
}

export async function updateWorkspace(
  id: string,
  updates: UpdateWorkspaceInput,
): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const col = await getWorkspaceCollection();

  const set: Partial<WorkspaceDoc> = { updatedAt: new Date() };
  if (typeof updates.name === 'string' && updates.name.trim()) {
    set.name = updates.name.trim();
  }
  if (typeof updates.iconUrl === 'string') {
    set.iconUrl = updates.iconUrl;
  }
  if (updates.plan) {
    set.plan = updates.plan;
  }
  if (typeof updates.slug === 'string' && updates.slug.trim()) {
    const nextSlug = toSlug(updates.slug);
    // Only replace if no one else already owns it.
    const clash = await col.findOne({
      slug: nextSlug,
      _id: { $ne: new ObjectId(id) },
    });
    if (!clash) set.slug = nextSlug;
  }

  await col.updateOne({ _id: new ObjectId(id) }, { $set: set });
}

export async function deleteWorkspace(id: string): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const col = await getWorkspaceCollection();
  const memberCol = await getMemberCollection();
  const inviteCol = await getInviteCollection();

  const workspaceId = id;
  await Promise.all([
    col.deleteOne({ _id: new ObjectId(id) }),
    memberCol.deleteMany({ workspaceId }),
    inviteCol.deleteMany({ workspaceId }),
  ]);
}

/* ══════════════════════════════════════════════════════════
   Members
   ══════════════════════════════════════════════════════════ */

export async function getWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const memberCol = await getMemberCollection();
  const { db } = await connectToDatabase();
  const userCol = db.collection<UserLookupDoc>('users');

  const docs = await memberCol
    .find({ workspaceId })
    .sort({ joinedAt: 1 })
    .toArray();
  if (docs.length === 0) return [];

  const userOids = docs
    .map((d) => d.userId)
    .filter((u): u is string => typeof u === 'string' && ObjectId.isValid(u))
    .map((u) => new ObjectId(u));

  const users = userOids.length
    ? await userCol
        .find(
          { _id: { $in: userOids } },
          { projection: { email: 1, name: 1 } },
        )
        .toArray()
    : [];
  const userMap = new Map(users.map((u) => [u._id.toHexString(), u]));

  return docs.map((d) => mapMember(d, userMap.get(d.userId)));
}

export async function addWorkspaceMember(
  input: AddWorkspaceMemberInput,
): Promise<void> {
  const memberCol = await getMemberCollection();
  // Upsert by (workspaceId, userId).
  await memberCol.updateOne(
    { workspaceId: input.workspaceId, userId: input.userId },
    {
      $setOnInsert: {
        _id: new ObjectId(),
        workspaceId: input.workspaceId,
        userId: input.userId,
        role: input.role,
        invitedBy: input.invitedBy,
        joinedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

export async function updateWorkspaceMemberRole(
  memberId: string,
  role: WorkspaceRole,
): Promise<void> {
  if (!ObjectId.isValid(memberId)) return;
  const memberCol = await getMemberCollection();
  await memberCol.updateOne({ _id: new ObjectId(memberId) }, { $set: { role } });
}

export async function removeWorkspaceMember(memberId: string): Promise<void> {
  if (!ObjectId.isValid(memberId)) return;
  const memberCol = await getMemberCollection();
  await memberCol.deleteOne({ _id: new ObjectId(memberId) });
}

export async function getMemberRole(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceRole | null> {
  const memberCol = await getMemberCollection();
  const doc = await memberCol.findOne(
    { workspaceId, userId },
    { projection: { role: 1 } },
  );
  return doc?.role ?? null;
}

/* ══════════════════════════════════════════════════════════
   Invites
   ══════════════════════════════════════════════════════════ */

const DEFAULT_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createInvite(
  input: CreateInviteInput,
): Promise<WorkspaceInvite> {
  const col = await getInviteCollection();
  const now = new Date();

  const doc: WorkspaceInviteDoc = {
    _id: new ObjectId(),
    workspaceId: input.workspaceId,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    invitedBy: input.invitedBy,
    token: newToken(),
    expiresAt: new Date(now.getTime() + (input.ttlMs ?? DEFAULT_INVITE_TTL_MS)),
    createdAt: now,
  };

  await col.insertOne(doc);
  return mapInvite(doc);
}

export async function getInviteByToken(
  token: string,
): Promise<WorkspaceInvite | null> {
  const col = await getInviteCollection();
  const doc = await col.findOne({ token });
  return doc ? mapInvite(doc) : null;
}

export async function getInviteById(
  id: string,
): Promise<WorkspaceInvite | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await getInviteCollection();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  return doc ? mapInvite(doc) : null;
}

export async function getInvitesByWorkspace(
  workspaceId: string,
): Promise<WorkspaceInvite[]> {
  const col = await getInviteCollection();
  const docs = await col
    .find({ workspaceId, acceptedAt: { $exists: false } })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(mapInvite);
}

export async function deleteInvite(id: string): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const col = await getInviteCollection();
  await col.deleteOne({ _id: new ObjectId(id) });
}

/**
 * Accepts an invite for a given userId. Adds them as a member with the
 * invite's role, then marks the invite as accepted. Idempotent.
 */
export async function acceptInvite(
  token: string,
  userId: string,
): Promise<void> {
  const col = await getInviteCollection();
  const invite = await col.findOne({ token });
  if (!invite) throw new Error('Invite not found');

  if (invite.acceptedAt) return; // already accepted, idempotent
  if (invite.expiresAt.getTime() < Date.now()) {
    throw new Error('Invite has expired');
  }

  await addWorkspaceMember({
    workspaceId: invite.workspaceId,
    userId,
    role: invite.role,
    invitedBy: invite.invitedBy,
  });

  await col.updateOne(
    { _id: invite._id },
    { $set: { acceptedAt: new Date() } },
  );
}
