import 'server-only';

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getEffectivePermissionsForProject } from '@/lib/rbac-server';
import { isElevatedRole, type EffectivePermissions } from '@/lib/rbac';

import { getSabAdminCollections, ensureSabAdminIndexes } from './db/collections';
import type { SabAdminSettings, DomainMode, UsernameConvention } from './types';

/**
 * SabAdmin tenancy + gate.
 *
 * The Admin Center is the org owner's (and elevated admins') command center.
 * `ownerUserId` is the tenant key for every SabAdmin doc:
 *   • a project owner          → the tenant is themselves
 *   • an elevated `admin` agent → the tenant is the project's owner
 * Anyone else is refused. The actor's own EffectivePermissions are the ceiling
 * on what they can grant (see `access-catalog.ts`).
 */
export interface SabAdminContext {
  actorUserId: string;
  actorEmail: string;
  /** The tenant owner `users._id` string every SabAdmin doc is scoped by. */
  ownerUserId: string;
  /** True when the actor IS the tenant owner. */
  isOwner: boolean;
  /** The actor's resolved permissions — the upper bound on grants. */
  effective: EffectivePermissions;
}

export type SabAdminContextResult =
  | { ok: true; ctx: SabAdminContext }
  | { ok: false; error: string };

/** Resolve (and authorize) the acting admin's tenant context. */
export async function getSabAdminContext(): Promise<SabAdminContextResult> {
  const session = await getSession();
  const sessionUser = session?.user as { _id?: unknown; email?: unknown } | undefined;
  if (!sessionUser?._id || !ObjectId.isValid(String(sessionUser._id))) {
    return { ok: false, error: 'Authentication required.' };
  }
  const actorUserId = String(sessionUser._id);
  const actorEmail = String(sessionUser.email ?? '');

  const effective = await getEffectivePermissionsForProject();
  if (!effective) return { ok: false, error: 'Authentication required.' };

  const { db } = await connectToDatabase();
  const actorOid = new ObjectId(actorUserId);

  // Owner of any project → the tenant is themselves.
  const owned = await db
    .collection('projects')
    .findOne({ userId: actorOid }, { projection: { _id: 1 } });
  if (owned) {
    return {
      ok: true,
      ctx: { actorUserId, actorEmail, ownerUserId: actorUserId, isOwner: true, effective },
    };
  }

  // Elevated admin agent on someone's project → the tenant is that owner.
  const adminProject = await db
    .collection('projects')
    .findOne({ 'agents.userId': actorOid }, { projection: { userId: 1, agents: 1 } });
  if (adminProject) {
    const agent = (adminProject.agents || []).find(
      (a: { userId?: { equals?: (o: ObjectId) => boolean } }) => a.userId?.equals?.(actorOid),
    );
    const roleId: string = (agent as { role?: string } | undefined)?.role || 'agent';
    if (isElevatedRole(roleId)) {
      return {
        ok: true,
        ctx: {
          actorUserId,
          actorEmail,
          ownerUserId: String(adminProject.userId),
          isOwner: false,
          effective,
        },
      };
    }
  }

  return {
    ok: false,
    error: 'Only the account owner or an admin can use the Admin Center.',
  };
}

/* ── settings ─────────────────────────────────────────────────────────── */

const DEFAULT_SETTINGS = (ownerUserId: string): SabAdminSettings => {
  const now = new Date();
  return {
    ownerUserId,
    domainMode: 'custom',
    usernameConvention: 'first.last',
    createdAt: now,
    updatedAt: now,
  };
};

/** Load the org's SabAdmin settings, creating defaults on first access. */
export async function getOrInitSabAdminSettings(
  ownerUserId: string,
): Promise<SabAdminSettings> {
  const { cols } = await getSabAdminCollections();
  const existing = await cols.settings.findOne({ ownerUserId });
  if (existing) return existing;
  await ensureSabAdminIndexes();
  const doc = DEFAULT_SETTINGS(ownerUserId);
  await cols.settings.updateOne(
    { ownerUserId },
    { $setOnInsert: doc },
    { upsert: true },
  );
  return (await cols.settings.findOne({ ownerUserId })) ?? doc;
}

/** Persist a partial settings update. */
export async function updateSabAdminSettings(
  ownerUserId: string,
  patch: Partial<
    Pick<
      SabAdminSettings,
      | 'mailWorkspaceId'
      | 'domainMode'
      | 'sharedDomain'
      | 'orgSlug'
      | 'usernameConvention'
      | 'defaultPackageId'
      | 'sabcrmProjectId'
    >
  >,
): Promise<SabAdminSettings> {
  const { cols } = await getSabAdminCollections();
  await ensureSabAdminIndexes();
  await cols.settings.updateOne(
    { ownerUserId },
    {
      $set: { ...patch, updatedAt: new Date() },
      $setOnInsert: { ownerUserId, createdAt: new Date() },
    },
    { upsert: true },
  );
  return (await cols.settings.findOne({ ownerUserId })) ?? DEFAULT_SETTINGS(ownerUserId);
}

/* ── mail workspace + domain resolution ───────────────────────────────── */

/** Resolve the `kind:'mail'` SabMail project mailboxes are provisioned into. */
export async function resolveMailWorkspaceId(
  ownerUserId: string,
  settings?: SabAdminSettings,
): Promise<string | null> {
  if (settings?.mailWorkspaceId) return settings.mailWorkspaceId;
  if (!ObjectId.isValid(ownerUserId)) return null;
  const { db } = await connectToDatabase();
  const proj = await db
    .collection('projects')
    .findOne({ userId: new ObjectId(ownerUserId), kind: 'mail' }, { projection: { _id: 1 } });
  return proj ? String(proj._id) : null;
}

/** The owner's projects (id + name), oldest first — for the SabCRM-project picker. */
export async function listOwnerProjects(
  ownerUserId: string,
): Promise<Array<{ id: string; name: string }>> {
  if (!ObjectId.isValid(ownerUserId)) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection('projects')
    .find({ userId: new ObjectId(ownerUserId) }, { projection: { name: 1 } })
    .sort({ createdAt: 1 })
    .limit(200)
    .toArray();
  return docs.map((d) => ({
    id: String(d._id),
    name: String((d as { name?: unknown }).name ?? 'Untitled project'),
  }));
}

/** Verified domains available for provisioning in a mail workspace. */
export async function listVerifiedDomains(workspaceId: string): Promise<string[]> {
  const { db } = await connectToDatabase();
  const docs = await db
    .collection('sabmail_domains')
    .find({ workspaceId, status: 'verified' }, { projection: { domain: 1 } })
    .toArray();
  return docs
    .map((d) => String((d as { domain?: unknown }).domain ?? '').toLowerCase())
    .filter(Boolean);
}

/**
 * Choose the default mailbox domain per the org's policy: "custom-if-verified,
 * else shared". When `domainMode === 'custom'` prefer the org's own verified
 * domain (anything that isn't the shared domain); otherwise prefer the shared
 * SabNode domain.
 */
export function pickDefaultDomain(
  domains: string[],
  settings: Pick<SabAdminSettings, 'domainMode' | 'sharedDomain'>,
): string | null {
  if (domains.length === 0) return null;
  const shared = settings.sharedDomain?.toLowerCase();
  const isShared = (d: string) => !!shared && (d === shared || d.endsWith(`.${shared}`));
  const custom = domains.filter((d) => !isShared(d));
  const sharedOnes = domains.filter((d) => isShared(d));
  if (settings.domainMode === 'shared') {
    return sharedOnes[0] ?? custom[0] ?? domains[0];
  }
  return custom[0] ?? sharedOnes[0] ?? domains[0];
}

/** Derive a mailbox local-part from a name using the org's convention. */
export function deriveLocalPart(
  firstName: string,
  lastName: string,
  convention: UsernameConvention,
): string {
  const clean = (s: string) =>
    (s || '')
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '');
  const f = clean(firstName);
  const l = clean(lastName);
  switch (convention) {
    case 'flast':
      return `${f.slice(0, 1)}${l}` || f || l;
    case 'firstlast':
      return `${f}${l}` || f || l;
    case 'first':
      return f || l;
    case 'first.last':
    default:
      return [f, l].filter(Boolean).join('.') || f || l;
  }
}

export type { DomainMode, UsernameConvention };
