'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ObjectId, type Db, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { invalidateProjectsCache } from '@/lib/server-cache';
import { SABSIGN_PROJECT_COOKIE } from '@/lib/sabsign/workspace';
import { getErrorMessage } from '@/lib/utils';
import type { Project } from '@/lib/definitions';

/* ──────────────────────────────────────────────────────────────────────
 * SabSign projects + mandatory setup.
 *
 * A SabSign "project" is a `kind:'sign'` row in the shared `projects`
 * collection (same model SabSMS uses). Its `_id` string is the `workspaceId`
 * the Rust engine scopes every `esign_*` collection by (via the JWT `tid`
 * claim — see `runWithRustTenant`).
 *
 * Flow enforced by `src/app/sabsign/layout.tsx`:
 *   create → select (sets the `sabsign_project` cookie) → finish setup
 *   (`sabsign.setupComplete = true`) → module unlocks.
 *
 * Unlike SabSMS there are no hard provider/compliance prerequisites, so the
 * setup step is a single confirmation.
 * ──────────────────────────────────────────────────────────────────── */

export interface SabsignProjectRow {
  id: string;
  name: string;
  setupComplete: boolean;
}

export interface SabsignSetupState {
  projectId: string;
  name: string;
  businessName: string | null;
  complete: boolean;
}

type Ok<T> = { success: true } & T;
type Err = { success: false; error: string };

async function requireSignProject(
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
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
    kind: 'sign',
    $or: [{ userId }, { 'agents.userId': userId }],
  });
  if (!project) {
    return { ok: false, error: 'Project not found or you do not have access.' };
  }
  return { ok: true, db, userId, project: project as WithId<Project> };
}

/* ── list ─────────────────────────────────────────────────────────────── */

export async function listSabsignProjects(): Promise<SabsignProjectRow[]> {
  try {
    const session = await getSession();
    const rawId = (session?.user as { _id?: unknown } | undefined)?._id;
    if (!rawId || !ObjectId.isValid(String(rawId))) return [];
    const userId = new ObjectId(String(rawId));

    const { db } = await connectToDatabase();
    const docs = await db
      .collection('projects')
      .find(
        { kind: 'sign', $or: [{ userId }, { 'agents.userId': userId }] },
        { projection: { name: 1, sabsign: 1, createdAt: 1 } },
      )
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    return docs.map((d) => {
      const doc = d as WithId<Project> & { sabsign?: { setupComplete?: boolean } };
      return {
        id: String(doc._id),
        name: doc.name,
        setupComplete: !!doc.sabsign?.setupComplete,
      };
    });
  } catch (err) {
    console.error('[sabsign] listSabsignProjects failed:', err);
    return [];
  }
}

/* ── create ───────────────────────────────────────────────────────────── */

export async function createSabsignProject(input: {
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

    const existing = await db
      .collection('projects')
      .findOne({ userId, name, kind: 'sign' }, { projection: { _id: 1 } });
    if (existing) {
      return { success: false, error: 'You already have a SabSign project with that name.' };
    }

    const now = new Date();
    const ins = await db.collection('projects').insertOne({
      userId,
      name,
      accessToken: '',
      phoneNumbers: [],
      // Discriminator so other modules' pickers skip this workspace and the
      // SabSign picker shows it.
      kind: 'sign',
      sabsign: { setupComplete: false },
      createdAt: now,
    } as never);

    invalidateProjectsCache(String(userId));
    revalidatePath('/sabsign/projects');
    return { success: true, projectId: ins.insertedId.toString(), name };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/* ── select / clear (cookie is the server-side source of truth) ───────── */

export async function setActiveSabsignProject(
  projectId: string,
): Promise<{ success: true } | Err> {
  const auth = await requireSignProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };

  const cookieStore = await cookies();
  cookieStore.set(SABSIGN_PROJECT_COOKIE, projectId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return { success: true };
}

export async function clearActiveSabsignProject(): Promise<{ success: true }> {
  const cookieStore = await cookies();
  cookieStore.delete(SABSIGN_PROJECT_COOKIE);
  return { success: true };
}

/* ── setup ────────────────────────────────────────────────────────────── */

export async function getSabsignSetupState(
  projectId: string,
): Promise<SabsignSetupState | null> {
  const auth = await requireSignProject(projectId);
  if (!auth.ok) return null;
  const { project } = auth;
  const sabsign = (project as WithId<Project> & {
    sabsign?: { setupComplete?: boolean; businessName?: string };
  }).sabsign;
  return {
    projectId: String(project._id),
    name: project.name,
    businessName: sabsign?.businessName ?? null,
    complete: !!sabsign?.setupComplete,
  };
}

/**
 * Finish setup. SabSign has no hard prerequisites, so this simply records an
 * optional business name (for white-label later) and flips `setupComplete` —
 * the single gate the layout trusts.
 */
export async function completeSabsignSetup(
  projectId: string,
  input?: { businessName?: string },
): Promise<{ success: true } | Err> {
  const auth = await requireSignProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };
  const { db, project } = auth;

  await db.collection('projects').updateOne(
    { _id: project._id },
    {
      $set: {
        'sabsign.setupComplete': true,
        'sabsign.setupCompletedAt': new Date(),
        ...(input?.businessName?.trim()
          ? { 'sabsign.businessName': input.businessName.trim() }
          : {}),
      },
    },
  );

  invalidateProjectsCache(String(project.userId));
  revalidatePath('/sabsign');
  return { success: true };
}
