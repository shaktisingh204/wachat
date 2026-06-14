'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ObjectId, type Db, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { invalidateProjectsCache } from '@/lib/server-cache';
import { SABSMS_PROJECT_COOKIE } from '@/lib/sabsms/workspace';
import { SABSMS_COLLECTIONS } from '@/lib/sabsms/db/collections';
import { getErrorMessage } from '@/lib/utils';
import type { Project } from '@/lib/definitions';

/* ──────────────────────────────────────────────────────────────────────
 * SabSMS projects + mandatory setup.
 *
 * A SabSMS "project" is a `kind:'sms'` row in the shared `projects`
 * collection (same model Telegram uses — see `addTelegramProject`).
 * Its `_id` string is the `workspaceId` every SabSMS collection scopes by.
 *
 * Flow enforced by `src/app/sabsms/layout.tsx`:
 *   create → select (sets the `sabsms_project` cookie) → complete setup
 *   (`sabsms.setupComplete = true`) → module unlocks.
 * ──────────────────────────────────────────────────────────────────── */

export type SabsmsSetupStep = 'profile' | 'provider' | 'sender' | 'compliance';
export type SabsmsRegion = 'IN' | 'US' | 'OTHER';

export interface SabsmsProjectRow {
  id: string;
  name: string;
  setupComplete: boolean;
  region: SabsmsRegion | null;
}

export interface SabsmsSetupState {
  projectId: string;
  name: string;
  region: SabsmsRegion | null;
  businessName: string | null;
  businessProfile: { website?: string; industry?: string; useCase?: string } | null;
  compliance: NonNullable<Project['sabsms']>['compliance'] | null;
  steps: { profile: boolean; provider: boolean; sender: boolean; compliance: boolean };
  providerCount: number;
  senderCount: number;
  complete: boolean;
}

type Ok<T> = { success: true } & T;
type Err = { success: false; error: string };

/* ── internal: load + authorize an SMS project ───────────────────────── */

async function requireSmsProject(
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
    kind: 'sms',
    $or: [{ userId }, { 'agents.userId': userId }],
  });
  if (!project) {
    return { ok: false, error: 'Project not found or you do not have access.' };
  }
  return { ok: true, db, userId, project: project as WithId<Project> };
}

/* ── list ─────────────────────────────────────────────────────────────── */

export async function listSabsmsProjects(): Promise<SabsmsProjectRow[]> {
  try {
    const session = await getSession();
    const rawId = (session?.user as { _id?: unknown } | undefined)?._id;
    if (!rawId || !ObjectId.isValid(String(rawId))) return [];
    const userId = new ObjectId(String(rawId));

    const { db } = await connectToDatabase();
    const docs = await db
      .collection('projects')
      .find(
        { kind: 'sms', $or: [{ userId }, { 'agents.userId': userId }] },
        { projection: { name: 1, sabsms: 1, createdAt: 1 } },
      )
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    return docs.map((d) => {
      const doc = d as WithId<Project>;
      return {
        id: String(doc._id),
        name: doc.name,
        setupComplete: !!doc.sabsms?.setupComplete,
        region: (doc.sabsms?.region as SabsmsRegion | undefined) ?? null,
      };
    });
  } catch (err) {
    console.error('[sabsms] listSabsmsProjects failed:', err);
    return [];
  }
}

/* ── create ───────────────────────────────────────────────────────────── */

export async function createSabsmsProject(input: {
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

    // Soft duplicate guard — same owner + same name within SabSMS.
    const existing = await db
      .collection('projects')
      .findOne({ userId, name, kind: 'sms' }, { projection: { _id: 1 } });
    if (existing) {
      return { success: false, error: 'You already have a SabSMS project with that name.' };
    }

    const now = new Date();
    const ins = await db.collection('projects').insertOne({
      userId,
      name,
      accessToken: '',
      phoneNumbers: [],
      // Discriminator so other modules' pickers (Wachat, CRM, Telegram)
      // skip this workspace, and the SabSMS picker shows it.
      kind: 'sms',
      sabsms: { setupComplete: false, setupSteps: {} },
      createdAt: now,
    } as never);

    invalidateProjectsCache(String(userId));
    revalidatePath('/sabsms/projects');
    return { success: true, projectId: ins.insertedId.toString(), name };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/* ── select / clear (cookie is the server-side source of truth) ───────── */

export async function setActiveSabsmsProject(
  projectId: string,
): Promise<{ success: true } | Err> {
  const auth = await requireSmsProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };

  const cookieStore = await cookies();
  cookieStore.set(SABSMS_PROJECT_COOKIE, projectId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return { success: true };
}

export async function clearActiveSabsmsProject(): Promise<{ success: true }> {
  const cookieStore = await cookies();
  cookieStore.delete(SABSMS_PROJECT_COOKIE);
  return { success: true };
}

/* ── setup state ──────────────────────────────────────────────────────── */

export async function getSabsmsSetupState(
  projectId: string,
): Promise<SabsmsSetupState | null> {
  const auth = await requireSmsProject(projectId);
  if (!auth.ok) return null;
  const { db, project } = auth;
  const sabsms = project.sabsms ?? {};
  const workspaceId = String(project._id);

  const [providerCount, senderCount] = await Promise.all([
    db.collection(SABSMS_COLLECTIONS.providerAccounts).countDocuments({ workspaceId }),
    db.collection(SABSMS_COLLECTIONS.numbers).countDocuments({ workspaceId }),
  ]);

  const steps = {
    profile: !!sabsms.setupSteps?.profile,
    provider: !!sabsms.setupSteps?.provider || providerCount > 0,
    sender: !!sabsms.setupSteps?.sender || senderCount > 0,
    compliance: !!sabsms.setupSteps?.compliance,
  };

  return {
    projectId: workspaceId,
    name: project.name,
    region: (sabsms.region as SabsmsRegion | undefined) ?? null,
    businessName: sabsms.businessName ?? null,
    businessProfile: sabsms.businessProfile ?? null,
    compliance: sabsms.compliance ?? null,
    steps,
    providerCount,
    senderCount,
    complete: !!sabsms.setupComplete,
  };
}

/* ── step writers ─────────────────────────────────────────────────────── */

export async function saveSabsmsProfileStep(
  projectId: string,
  input: {
    businessName: string;
    region: SabsmsRegion;
    businessProfile?: { website?: string; industry?: string; useCase?: string };
  },
): Promise<{ success: true } | Err> {
  const auth = await requireSmsProject(projectId);
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
        'sabsms.businessName': businessName,
        'sabsms.region': input.region,
        'sabsms.businessProfile': {
          website: input.businessProfile?.website?.trim() || undefined,
          industry: input.businessProfile?.industry?.trim() || undefined,
          useCase: input.businessProfile?.useCase?.trim() || undefined,
        },
        'sabsms.setupSteps.profile': true,
      },
    },
  );
  return { success: true };
}

/**
 * Persist a sender (numeric long/short code or alphanumeric sender ID) into
 * `sabsms_numbers`, scoped to the project workspace. Mirrors the
 * `SabsmsNumberSchema` shape so it shows up in /sabsms/numbers afterwards.
 */
export async function saveSabsmsSenderStep(
  projectId: string,
  input: {
    type: 'alphanumeric' | 'longcode' | 'shortcode' | 'tollfree';
    value: string; // e164 (numeric) or sender id (alphanumeric)
    country?: string;
  },
): Promise<{ success: true } | Err> {
  const auth = await requireSmsProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };

  const value = input.value?.trim();
  if (!value) return { success: false, error: 'Enter a sender number or sender ID.' };

  const workspaceId = String(auth.project._id);
  const isAlpha = input.type === 'alphanumeric';
  const now = new Date();
  const col = auth.db.collection(SABSMS_COLLECTIONS.numbers);

  // Idempotent: one sender row per (workspace, value).
  await col.updateOne(
    { workspaceId, e164: value },
    {
      $set: {
        type: input.type,
        country: input.country?.trim() || (isAlpha ? 'XX' : 'US'),
        status: 'active',
        capabilities: { sms: true, mms: false, rcs: false, voice: false },
        ...(isAlpha ? { senderId: value } : {}),
        updatedAt: now,
      },
      $setOnInsert: {
        workspaceId,
        e164: value,
        // provider is assigned when routing is configured; default to the
        // workspace's first provider at send time.
        provider: 'twilio',
        createdAt: now,
      },
    },
    { upsert: true },
  );

  await auth.db
    .collection('projects')
    .updateOne({ _id: auth.project._id }, { $set: { 'sabsms.setupSteps.sender': true } });

  return { success: true };
}

export async function saveSabsmsComplianceStep(
  projectId: string,
  input: {
    dltEntityId?: string;
    dltHeaderId?: string;
    tenDlcBrandId?: string;
    tenDlcCampaignId?: string;
    acknowledged?: boolean;
  },
): Promise<{ success: true } | Err> {
  const auth = await requireSmsProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };

  const region = (auth.project.sabsms?.region as SabsmsRegion | undefined) ?? 'OTHER';
  const compliance = {
    dltEntityId: input.dltEntityId?.trim() || undefined,
    dltHeaderId: input.dltHeaderId?.trim() || undefined,
    tenDlcBrandId: input.tenDlcBrandId?.trim() || undefined,
    tenDlcCampaignId: input.tenDlcCampaignId?.trim() || undefined,
    acknowledged: !!input.acknowledged,
  };

  // Region-driven minimum requirements.
  if (region === 'IN' && !compliance.dltEntityId) {
    return { success: false, error: 'A DLT Principal Entity ID is required for India.' };
  }
  if (region === 'US' && !compliance.tenDlcBrandId) {
    return { success: false, error: 'A 10DLC Brand ID is required for US sending.' };
  }
  if (region === 'OTHER' && !compliance.acknowledged) {
    return { success: false, error: 'Please confirm the opt-in / sender-ID attestation.' };
  }

  await auth.db.collection('projects').updateOne(
    { _id: auth.project._id },
    { $set: { 'sabsms.compliance': compliance, 'sabsms.setupSteps.compliance': true } },
  );
  return { success: true };
}

/**
 * Mark a step done from the wizard after the underlying data was written by
 * a reused action (e.g. the provider step calls `saveProviderAccountAction`).
 */
export async function markSabsmsSetupStep(
  projectId: string,
  step: SabsmsSetupStep,
): Promise<{ success: true } | Err> {
  const auth = await requireSmsProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };
  await auth.db
    .collection('projects')
    .updateOne({ _id: auth.project._id }, { $set: { [`sabsms.setupSteps.${step}`]: true } });
  return { success: true };
}

/* ── finish ───────────────────────────────────────────────────────────── */

/**
 * Re-validate every prerequisite against the ACTUAL stored data (not just
 * the UI step flags) and flip `setupComplete`. This is the single gate the
 * layout trusts.
 */
export async function completeSabsmsSetup(
  projectId: string,
): Promise<{ success: true } | Err> {
  const auth = await requireSmsProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };
  const { db, project } = auth;
  const workspaceId = String(project._id);
  const sabsms = project.sabsms ?? {};
  const region = (sabsms.region as SabsmsRegion | undefined) ?? null;

  if (!sabsms.businessName || !region) {
    return { success: false, error: 'Complete the business profile step first.' };
  }

  const [providerCount, senderCount] = await Promise.all([
    db.collection(SABSMS_COLLECTIONS.providerAccounts).countDocuments({ workspaceId }),
    db.collection(SABSMS_COLLECTIONS.numbers).countDocuments({ workspaceId }),
  ]);
  if (providerCount === 0) {
    return { success: false, error: 'Connect at least one provider first.' };
  }
  if (senderCount === 0) {
    return { success: false, error: 'Add at least one sender number or sender ID first.' };
  }

  const c = sabsms.compliance ?? {};
  if (region === 'IN' && !c.dltEntityId) {
    return { success: false, error: 'India DLT registration is required.' };
  }
  if (region === 'US' && !c.tenDlcBrandId) {
    return { success: false, error: 'US 10DLC registration is required.' };
  }
  if (region === 'OTHER' && !c.acknowledged) {
    return { success: false, error: 'Compliance attestation is required.' };
  }

  await db.collection('projects').updateOne(
    { _id: project._id },
    {
      $set: {
        'sabsms.setupComplete': true,
        'sabsms.setupCompletedAt': new Date(),
        'sabsms.setupSteps': {
          profile: true,
          provider: true,
          sender: true,
          compliance: true,
        },
      },
    },
  );

  const userId = String(project.userId);
  invalidateProjectsCache(userId);
  revalidatePath('/sabsms');
  return { success: true };
}
