'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ObjectId, type Db, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { invalidateProjectsCache } from '@/lib/server-cache';
import { SABCALL_PROJECT_COOKIE } from '@/lib/sabcall/workspace';
import { getErrorMessage } from '@/lib/utils';
import type { Project } from '@/lib/definitions';

/* ──────────────────────────────────────────────────────────────────────
 * SabCall projects + mandatory setup.
 *
 * A SabCall "project" is a `kind:'call'` row in the shared `projects`
 * collection (same model SabSMS/SabMail/SabChat use). Its `_id` string is
 * the `workspaceId` every SabCall collection scopes by.
 *
 * Flow enforced by `src/app/sabcall/layout.tsx`:
 *   create → select (sets the `sabcall_project` cookie) → complete setup
 *   (`sabcall.setupComplete = true`) → module unlocks.
 *
 * P0 keeps setup minimal: a single "business profile" step (name + region).
 * Number provisioning / SIP trunks / compliance arrive with the engine
 * phase and will extend `setupSteps` then.
 * ──────────────────────────────────────────────────────────────────── */

export type SabcallRegion = 'IN' | 'US' | 'OTHER';

export interface SabcallProjectRow {
  id: string;
  name: string;
  setupComplete: boolean;
  region: SabcallRegion | null;
}

export interface SabcallSetupState {
  projectId: string;
  name: string;
  region: SabcallRegion | null;
  businessName: string | null;
  businessProfile: { website?: string; industry?: string; useCase?: string } | null;
  steps: { profile: boolean };
  complete: boolean;
}

type Ok<T> = { success: true } & T;
type Err = { success: false; error: string };

/* ── internal: load + authorize a call project ───────────────────────── */

async function requireCallProject(
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
    kind: 'call',
    $or: [{ userId }, { 'agents.userId': userId }],
  });
  if (!project) {
    return { ok: false, error: 'Project not found or you do not have access.' };
  }
  return { ok: true, db, userId, project: project as WithId<Project> };
}

/* ── list ─────────────────────────────────────────────────────────────── */

export async function listSabcallProjects(): Promise<SabcallProjectRow[]> {
  try {
    const session = await getSession();
    const rawId = (session?.user as { _id?: unknown } | undefined)?._id;
    if (!rawId || !ObjectId.isValid(String(rawId))) return [];
    const userId = new ObjectId(String(rawId));

    const { db } = await connectToDatabase();
    const docs = await db
      .collection('projects')
      .find(
        { kind: 'call', $or: [{ userId }, { 'agents.userId': userId }] },
        { projection: { name: 1, sabcall: 1, createdAt: 1 } },
      )
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    return docs.map((d) => {
      const doc = d as WithId<Project>;
      return {
        id: String(doc._id),
        name: doc.name,
        setupComplete: !!doc.sabcall?.setupComplete,
        region: (doc.sabcall?.region as SabcallRegion | undefined) ?? null,
      };
    });
  } catch (err) {
    console.error('[sabcall] listSabcallProjects failed:', err);
    return [];
  }
}

/* ── create ───────────────────────────────────────────────────────────── */

export async function createSabcallProject(input: {
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

    // Soft duplicate guard — same owner + same name within SabCall.
    const existing = await db
      .collection('projects')
      .findOne({ userId, name, kind: 'call' }, { projection: { _id: 1 } });
    if (existing) {
      return { success: false, error: 'You already have a SabCall project with that name.' };
    }

    const now = new Date();
    const ins = await db.collection('projects').insertOne({
      userId,
      name,
      accessToken: '',
      phoneNumbers: [],
      // Discriminator so other modules' pickers skip this workspace and the
      // SabCall picker shows it.
      kind: 'call',
      sabcall: { setupComplete: false, setupSteps: {} },
      createdAt: now,
    } as never);

    invalidateProjectsCache(String(userId));
    revalidatePath('/sabcall/projects');
    return { success: true, projectId: ins.insertedId.toString(), name };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/* ── select / clear (cookie is the server-side source of truth) ───────── */

export async function setActiveSabcallProject(
  projectId: string,
): Promise<{ success: true } | Err> {
  const auth = await requireCallProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };

  const cookieStore = await cookies();
  cookieStore.set(SABCALL_PROJECT_COOKIE, projectId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return { success: true };
}

export async function clearActiveSabcallProject(): Promise<{ success: true }> {
  const cookieStore = await cookies();
  cookieStore.delete(SABCALL_PROJECT_COOKIE);
  return { success: true };
}

/* ── setup state ──────────────────────────────────────────────────────── */

export async function getSabcallSetupState(
  projectId: string,
): Promise<SabcallSetupState | null> {
  const auth = await requireCallProject(projectId);
  if (!auth.ok) return null;
  const { project } = auth;
  const sabcall = project.sabcall ?? {};

  return {
    projectId: String(project._id),
    name: project.name,
    region: (sabcall.region as SabcallRegion | undefined) ?? null,
    businessName: sabcall.businessName ?? null,
    businessProfile: sabcall.businessProfile ?? null,
    steps: { profile: !!sabcall.setupSteps?.profile },
    complete: !!sabcall.setupComplete,
  };
}

/* ── step writer: business profile ────────────────────────────────────── */

export async function saveSabcallProfileStep(
  projectId: string,
  input: {
    businessName: string;
    region: SabcallRegion;
    businessProfile?: { website?: string; industry?: string; useCase?: string };
  },
): Promise<{ success: true } | Err> {
  const auth = await requireCallProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };

  const businessName = input.businessName?.trim();
  if (!businessName) return { success: false, error: 'Business name is required.' };
  if (!['IN', 'US', 'OTHER'].includes(input.region)) {
    return { success: false, error: 'Pick a region.' };
  }

  await auth.db.collection('projects').updateOne(
    { _id: auth.project._id },
    {
      $set: {
        'sabcall.businessName': businessName,
        'sabcall.region': input.region,
        'sabcall.businessProfile': {
          website: input.businessProfile?.website?.trim() || undefined,
          industry: input.businessProfile?.industry?.trim() || undefined,
          useCase: input.businessProfile?.useCase?.trim() || undefined,
        },
        'sabcall.setupSteps.profile': true,
      },
    },
  );
  return { success: true };
}

/* ── finish ───────────────────────────────────────────────────────────── */

/**
 * Re-validate the prerequisites against the ACTUAL stored data and flip
 * `setupComplete`. This is the single gate the layout trusts. P0 requires
 * only the business profile (name + region).
 */
export async function completeSabcallSetup(
  projectId: string,
): Promise<{ success: true } | Err> {
  const auth = await requireCallProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };
  const { db, project } = auth;
  const sabcall = project.sabcall ?? {};
  const region = (sabcall.region as SabcallRegion | undefined) ?? null;

  if (!sabcall.businessName || !region) {
    return { success: false, error: 'Complete the business profile step first.' };
  }

  await db.collection('projects').updateOne(
    { _id: project._id },
    {
      $set: {
        'sabcall.setupComplete': true,
        'sabcall.setupCompletedAt': new Date(),
        'sabcall.setupSteps': { profile: true },
      },
    },
  );

  invalidateProjectsCache(String(project.userId));
  revalidatePath('/sabcall');
  return { success: true };
}
