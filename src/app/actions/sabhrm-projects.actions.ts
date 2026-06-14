'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ObjectId, type Db, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { invalidateProjectsCache } from '@/lib/server-cache';
import { SABHRM_PROJECT_COOKIE } from '@/lib/sabhrm/workspace';
import { getErrorMessage } from '@/lib/utils';
import type { Project } from '@/lib/definitions';

/* ──────────────────────────────────────────────────────────────────────
 * SabHRM organizations (projects) + mandatory setup.
 *
 * A SabHRM "organization" is a `kind:'hrm'` row in the shared `projects`
 * collection (same model SabSMS / SabCall use). Its `_id` string is the
 * `workspaceId` every SabHRM collection scopes by.
 *
 * Flow enforced by `src/app/sabhrm/layout.tsx`:
 *   create → select (sets the `sabhrm_project` cookie) → complete setup
 *   (`sabhrm.setupComplete = true`) → module unlocks.
 * ──────────────────────────────────────────────────────────────────── */

export type SabHrmRegion = 'IN' | 'US' | 'OTHER';

export interface SabHrmProjectRow {
  id: string;
  name: string;
  setupComplete: boolean;
  region: SabHrmRegion | null;
}

export interface SabHrmSetupState {
  projectId: string;
  name: string;
  legalName: string | null;
  region: SabHrmRegion | null;
  currency: string | null;
  fiscalYearStartMonth: number | null;
  timezone: string | null;
  complete: boolean;
}

type Ok<T> = { success: true } & T;
type Err = { success: false; error: string };

const REGION_DEFAULTS: Record<SabHrmRegion, { currency: string; fyStart: number }> = {
  IN: { currency: 'INR', fyStart: 4 },
  US: { currency: 'USD', fyStart: 1 },
  OTHER: { currency: 'USD', fyStart: 1 },
};

/* ── internal: load + authorize an HRM project ───────────────────────── */

async function requireHrmProject(
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
    return { ok: false, error: 'Invalid organization id.' };
  }
  const userId = new ObjectId(String(rawId));
  const { db } = await connectToDatabase();
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
    kind: 'hrm',
    $or: [{ userId }, { 'agents.userId': userId }],
  });
  if (!project) {
    return { ok: false, error: 'Organization not found or you do not have access.' };
  }
  return { ok: true, db, userId, project: project as WithId<Project> };
}

/* ── list ─────────────────────────────────────────────────────────────── */

export async function listSabHrmProjects(): Promise<SabHrmProjectRow[]> {
  try {
    const session = await getSession();
    const rawId = (session?.user as { _id?: unknown } | undefined)?._id;
    if (!rawId || !ObjectId.isValid(String(rawId))) return [];
    const userId = new ObjectId(String(rawId));

    const { db } = await connectToDatabase();
    const docs = await db
      .collection('projects')
      .find(
        { kind: 'hrm', $or: [{ userId }, { 'agents.userId': userId }] },
        { projection: { name: 1, sabhrm: 1, createdAt: 1 } },
      )
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    return docs.map((d) => {
      const doc = d as WithId<Project>;
      return {
        id: String(doc._id),
        name: doc.name,
        setupComplete: !!doc.sabhrm?.setupComplete,
        region: (doc.sabhrm?.region as SabHrmRegion | undefined) ?? null,
      };
    });
  } catch (err) {
    console.error('[sabhrm] listSabHrmProjects failed:', err);
    return [];
  }
}

/* ── create ───────────────────────────────────────────────────────────── */

export async function createSabHrmProject(input: {
  name: string;
}): Promise<Ok<{ projectId: string; name: string }> | Err> {
  try {
    const name = input.name?.trim();
    if (!name) return { success: false, error: 'Organization name is required.' };
    if (name.length > 120) {
      return { success: false, error: 'Organization name is too long (max 120 chars).' };
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
      .findOne({ userId, name, kind: 'hrm' }, { projection: { _id: 1 } });
    if (existing) {
      return { success: false, error: 'You already have a SabHRM organization with that name.' };
    }

    const now = new Date();
    const ins = await db.collection('projects').insertOne({
      userId,
      name,
      accessToken: '',
      phoneNumbers: [],
      kind: 'hrm',
      sabhrm: { setupComplete: false, setupSteps: {} },
      createdAt: now,
    } as never);

    invalidateProjectsCache(String(userId));
    revalidatePath('/sabhrm/projects');
    return { success: true, projectId: ins.insertedId.toString(), name };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/* ── select / clear (cookie is the server-side source of truth) ───────── */

export async function setActiveSabHrmProject(
  projectId: string,
): Promise<{ success: true } | Err> {
  const auth = await requireHrmProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };

  const cookieStore = await cookies();
  cookieStore.set(SABHRM_PROJECT_COOKIE, projectId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return { success: true };
}

export async function clearActiveSabHrmProject(): Promise<{ success: true }> {
  const cookieStore = await cookies();
  cookieStore.delete(SABHRM_PROJECT_COOKIE);
  return { success: true };
}

/* ── setup ────────────────────────────────────────────────────────────── */

export async function getSabHrmSetupState(
  projectId: string,
): Promise<SabHrmSetupState | null> {
  const auth = await requireHrmProject(projectId);
  if (!auth.ok) return null;
  const { project } = auth;
  const sabhrm = project.sabhrm ?? {};
  return {
    projectId: String(project._id),
    name: project.name,
    legalName: sabhrm.legalName ?? null,
    region: (sabhrm.region as SabHrmRegion | undefined) ?? null,
    currency: sabhrm.currency ?? null,
    fiscalYearStartMonth: sabhrm.fiscalYearStartMonth ?? null,
    timezone: sabhrm.timezone ?? null,
    complete: !!sabhrm.setupComplete,
  };
}

export async function completeSabHrmSetup(
  projectId: string,
  input: {
    legalName: string;
    region: SabHrmRegion;
    currency?: string;
    fiscalYearStartMonth?: number;
    timezone?: string;
  },
): Promise<{ success: true } | Err> {
  const auth = await requireHrmProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };

  const legalName = input.legalName?.trim();
  if (!legalName) return { success: false, error: 'Organization legal name is required.' };
  if (!['IN', 'US', 'OTHER'].includes(input.region)) {
    return { success: false, error: 'Pick a region.' };
  }

  const defaults = REGION_DEFAULTS[input.region];
  const currency = (input.currency?.trim() || defaults.currency).toUpperCase();
  const fyStart =
    input.fiscalYearStartMonth && input.fiscalYearStartMonth >= 1 && input.fiscalYearStartMonth <= 12
      ? input.fiscalYearStartMonth
      : defaults.fyStart;

  await auth.db.collection('projects').updateOne(
    { _id: auth.project._id },
    {
      $set: {
        'sabhrm.legalName': legalName,
        'sabhrm.region': input.region,
        'sabhrm.currency': currency,
        'sabhrm.fiscalYearStartMonth': fyStart,
        'sabhrm.timezone': input.timezone?.trim() || undefined,
        'sabhrm.setupComplete': true,
        'sabhrm.setupCompletedAt': new Date(),
        'sabhrm.setupSteps': { profile: true },
      },
    },
  );

  invalidateProjectsCache(String(auth.project.userId));
  revalidatePath('/sabhrm');
  return { success: true };
}
