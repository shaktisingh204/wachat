'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ObjectId, type Db, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { invalidateProjectsCache } from '@/lib/server-cache';
import { SABCHAT_PROJECT_COOKIE } from '@/lib/sabchat/workspace';
import { rustClient } from '@/lib/rust-client';
import { runWithRustTenant } from '@/lib/rust-client/fetcher';
import { getErrorMessage } from '@/lib/utils';
import type { Project } from '@/lib/definitions';

/* ──────────────────────────────────────────────────────────────────────
 * SabChat projects + mandatory setup.
 *
 * A SabChat "project" is a `kind:'chat'` row in the shared `projects`
 * collection (same model SabSMS / SabMail use). Its `_id` string is the
 * `workspaceId` — the tenant key every SabChat server action passes to
 * `runWithRustTenant` before calling the Rust `sabchat-*` engine.
 *
 * Flow enforced by `src/app/sabchat/layout.tsx`:
 *   create → select (sets the `sabchat_project` cookie) → complete setup
 *   (`sabchat.setupComplete = true`) → module unlocks.
 * ──────────────────────────────────────────────────────────────────── */

export type SabchatSetupStep = 'profile' | 'inbox';

export interface SabchatProjectRow {
  id: string;
  name: string;
  setupComplete: boolean;
  businessName: string | null;
}

export interface SabchatSetupState {
  projectId: string;
  name: string;
  businessName: string | null;
  businessProfile: { website?: string; industry?: string; useCase?: string } | null;
  logoUrl: string | null;
  brandColor: string | null;
  defaultInboxId: string | null;
  steps: { profile: boolean; inbox: boolean };
  inboxCount: number;
  /** True when the Rust engine couldn't be reached to count inboxes. */
  engineOffline: boolean;
  complete: boolean;
}

type Ok<T> = { success: true } & T;
type Err = { success: false; error: string };

/* ── internal: load + authorize a chat project ───────────────────────── */

async function requireChatProject(
  projectId: string,
): Promise<
  | { ok: true; db: Db; userId: ObjectId; project: WithId<Project> }
  | { ok: false; error: string }
> {
  const session = await getSession();
  const rawId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!rawId || !ObjectId.isValid(String(rawId))) {
    return { ok: false, error: 'Not authenticated.' };
  }
  if (!projectId || !ObjectId.isValid(projectId)) {
    return { ok: false, error: 'Invalid project id.' };
  }
  const userId = new ObjectId(String(rawId));
  const { db } = await connectToDatabase();
  // Untyped collection — the `agents.userId` dot-path filter isn't expressible
  // in the strict `Filter<Project>` type (matches the rbac-server pattern).
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
    kind: 'chat',
    $or: [{ userId }, { 'agents.userId': userId }],
  });
  if (!project) {
    return { ok: false, error: 'Project not found or you do not have access.' };
  }
  return { ok: true, db, userId, project: project as WithId<Project> };
}

/**
 * Best-effort count of inboxes in a chat workspace via the Rust engine.
 * Tolerant of an offline engine (local dev) — returns `offline: true` rather
 * than throwing so the setup wizard never hard-blocks on the engine.
 */
async function countInboxes(
  workspaceId: string,
): Promise<{ count: number; offline: boolean }> {
  try {
    const res = (await runWithRustTenant(workspaceId, () =>
      rustClient.sabchat.inboxes.list(),
    )) as unknown;
    const arr = Array.isArray(res)
      ? res
      : Array.isArray((res as { items?: unknown[] })?.items)
        ? (res as { items: unknown[] }).items
        : [];
    return { count: arr.length, offline: false };
  } catch {
    return { count: 0, offline: true };
  }
}

/* ── list ─────────────────────────────────────────────────────────────── */

export async function listSabchatProjects(): Promise<SabchatProjectRow[]> {
  try {
    const session = await getSession();
    const rawId = (session?.user as { _id?: unknown } | undefined)?._id;
    if (!rawId || !ObjectId.isValid(String(rawId))) return [];
    const userId = new ObjectId(String(rawId));

    const { db } = await connectToDatabase();
    const docs = await db
      .collection('projects')
      .find(
        { kind: 'chat', $or: [{ userId }, { 'agents.userId': userId }] },
        { projection: { name: 1, sabchat: 1, createdAt: 1 } },
      )
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    return docs.map((d) => {
      const doc = d as WithId<Project>;
      return {
        id: String(doc._id),
        name: doc.name,
        setupComplete: !!doc.sabchat?.setupComplete,
        businessName: doc.sabchat?.businessName ?? null,
      };
    });
  } catch (err) {
    console.error('[sabchat] listSabchatProjects failed:', err);
    return [];
  }
}

/* ── create ───────────────────────────────────────────────────────────── */

export async function createSabchatProject(input: {
  name: string;
}): Promise<Ok<{ projectId: string; name: string }> | Err> {
  try {
    const name = input.name?.trim();
    if (!name) return { success: false, error: 'Project name is required.' };
    if (name.length > 120) {
      return { success: false, error: 'Project name is too long (max 120 chars).' };
    }

    const session = await getSession();
    const rawId = (session?.user as { _id?: unknown } | undefined)?._id;
    if (!rawId || !ObjectId.isValid(String(rawId))) {
      return { success: false, error: 'Not authenticated.' };
    }
    const userId = new ObjectId(String(rawId));
    const { db } = await connectToDatabase();

    // Soft duplicate guard — same owner + same name within SabChat.
    const existing = await db
      .collection('projects')
      .findOne({ userId, name, kind: 'chat' }, { projection: { _id: 1 } });
    if (existing) {
      return { success: false, error: 'You already have a SabChat project with that name.' };
    }

    const now = new Date();
    const ins = await db.collection('projects').insertOne({
      userId,
      name,
      accessToken: '',
      phoneNumbers: [],
      // Discriminator so other modules' pickers skip this workspace and the
      // SabChat picker shows it.
      kind: 'chat',
      sabchat: { setupComplete: false, setupSteps: {} },
      createdAt: now,
    } as never);

    invalidateProjectsCache(String(userId));
    revalidatePath('/sabchat/projects');
    return { success: true, projectId: ins.insertedId.toString(), name };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/* ── select / clear (cookie is the server-side source of truth) ───────── */

export async function setActiveSabchatProject(
  projectId: string,
): Promise<{ success: true } | Err> {
  const auth = await requireChatProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };

  const cookieStore = await cookies();
  cookieStore.set(SABCHAT_PROJECT_COOKIE, projectId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return { success: true };
}

export async function clearActiveSabchatProject(): Promise<{ success: true }> {
  const cookieStore = await cookies();
  cookieStore.delete(SABCHAT_PROJECT_COOKIE);
  return { success: true };
}

/* ── setup state ──────────────────────────────────────────────────────── */

export async function getSabchatSetupState(
  projectId: string,
): Promise<SabchatSetupState | null> {
  const auth = await requireChatProject(projectId);
  if (!auth.ok) return null;
  const { project } = auth;
  const sabchat = project.sabchat ?? {};
  const workspaceId = String(project._id);

  const { count: inboxCount, offline } = await countInboxes(workspaceId);

  const steps = {
    profile: !!sabchat.setupSteps?.profile,
    inbox: !!sabchat.setupSteps?.inbox || inboxCount > 0,
  };

  return {
    projectId: workspaceId,
    name: project.name,
    businessName: sabchat.businessName ?? null,
    businessProfile: sabchat.businessProfile ?? null,
    logoUrl: sabchat.logoUrl ?? null,
    brandColor: sabchat.brandColor ?? null,
    defaultInboxId: sabchat.defaultInboxId ?? null,
    steps,
    inboxCount,
    engineOffline: offline,
    complete: !!sabchat.setupComplete,
  };
}

/* ── step writers ─────────────────────────────────────────────────────── */

export async function saveSabchatProfileStep(
  projectId: string,
  input: {
    businessName: string;
    logoUrl?: string;
    brandColor?: string;
    businessProfile?: { website?: string; industry?: string; useCase?: string };
  },
): Promise<{ success: true } | Err> {
  const auth = await requireChatProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };

  const businessName = input.businessName?.trim();
  if (!businessName) return { success: false, error: 'Business name is required.' };

  await auth.db.collection('projects').updateOne(
    { _id: auth.project._id },
    {
      $set: {
        'sabchat.businessName': businessName,
        'sabchat.logoUrl': input.logoUrl?.trim() || undefined,
        'sabchat.brandColor': input.brandColor?.trim() || undefined,
        'sabchat.businessProfile': {
          website: input.businessProfile?.website?.trim() || undefined,
          industry: input.businessProfile?.industry?.trim() || undefined,
          useCase: input.businessProfile?.useCase?.trim() || undefined,
        },
        'sabchat.setupSteps.profile': true,
      },
    },
  );
  return { success: true };
}

/**
 * Create the workspace's first Website inbox via the Rust engine and pin it
 * as the default. Best-effort: if the engine is unreachable (local dev), it
 * still records the brand colour + intent and marks the step done, so the
 * wizard can proceed — the inbox is created later from the Widget Studio.
 */
export async function createSabchatInboxStep(
  projectId: string,
  input: { inboxName?: string; brandColor?: string },
): Promise<Ok<{ inboxId: string | null; engineOffline: boolean }> | Err> {
  const auth = await requireChatProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };

  const workspaceId = String(auth.project._id);
  const inboxName = input.inboxName?.trim() || 'Website';
  const brandColor = input.brandColor?.trim() || undefined;

  let inboxId: string | null = null;
  let engineOffline = false;
  try {
    const created = (await runWithRustTenant(workspaceId, () =>
      rustClient.sabchat.inboxes.create({
        name: inboxName,
        channelType: 'website',
      }),
    )) as { id?: string; _id?: string } | null;
    inboxId = created?.id ?? created?._id ?? null;
  } catch {
    engineOffline = true;
  }

  await auth.db.collection('projects').updateOne(
    { _id: auth.project._id },
    {
      $set: {
        ...(inboxId ? { 'sabchat.defaultInboxId': inboxId } : {}),
        ...(brandColor ? { 'sabchat.brandColor': brandColor } : {}),
        'sabchat.setupSteps.inbox': true,
      },
    },
  );

  return { success: true, inboxId, engineOffline };
}

export async function markSabchatSetupStep(
  projectId: string,
  step: SabchatSetupStep,
): Promise<{ success: true } | Err> {
  const auth = await requireChatProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };
  await auth.db
    .collection('projects')
    .updateOne({ _id: auth.project._id }, { $set: { [`sabchat.setupSteps.${step}`]: true } });
  return { success: true };
}

/* ── finish ───────────────────────────────────────────────────────────── */

/**
 * Re-validate prerequisites against stored data and flip `setupComplete`.
 * This is the single gate the layout trusts. Requires a business profile;
 * a default inbox is ensured best-effort (engine-offline does not block, so
 * local dev without the Rust engine can still complete setup).
 */
export async function completeSabchatSetup(
  projectId: string,
): Promise<{ success: true } | Err> {
  const auth = await requireChatProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };
  const { db, project } = auth;
  const sabchat = project.sabchat ?? {};

  if (!sabchat.businessName) {
    return { success: false, error: 'Complete the business profile step first.' };
  }

  await db.collection('projects').updateOne(
    { _id: project._id },
    {
      $set: {
        'sabchat.setupComplete': true,
        'sabchat.setupCompletedAt': new Date(),
        'sabchat.setupSteps': { profile: true, inbox: true },
      },
    },
  );

  invalidateProjectsCache(String(project.userId));
  revalidatePath('/sabchat');
  return { success: true };
}
