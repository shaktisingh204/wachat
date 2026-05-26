'use server';

/**
 * SabBigin (lite CRM SKU) — server actions.
 *
 * SabBigin reuses the existing CRM entity collections (`crm_contacts`,
 * `crm_deals`, `crm_pipelines`, `crm_products`, `crm_tasks`,
 * `crm_activities`) under a focused, micro-business UX mounted at
 * `/dashboard/sabbigin/`. This module owns **only** the per-tenant SabBigin
 * settings document (`sabbigin_configs`) — everything else delegates to the
 * existing CRM server actions.
 *
 * Data flow:
 *   • `USE_RUST_CRM=true`  → Rust `sabbigin_config` crate via `sabbiginConfigApi`.
 *   • otherwise            → direct Mongo via `connectToDatabase()`.
 *
 * Plan-gating:
 *   • `sessionUser.plan.features.crmSabbigin` is the canonical flag. The
 *     `/dashboard/sabbigin/layout.tsx` wraps every route with `<FeatureLock>`.
 *   • TODO: register the `crmSabbigin` feature key in `src/lib/plans.json`
 *     and price it into the "SabBigin" SKU tier.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import {
  sabbiginConfigApi,
  type SabbiginConfigDoc,
  type SabbiginConfigCreateInput,
  type SabbiginConfigUpdateInput,
  type SabbiginFeatureFlag,
} from '@/lib/rust-client/sabbigin-config';

const COLL = 'sabbigin_configs';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

const DEFAULT_FEATURES: SabbiginFeatureFlag[] = [
  'contacts',
  'products',
  'calls',
  'emails',
  'dashboard',
];

function freshDefault(userId: ObjectId): SabbiginConfigDoc {
  const now = new Date().toISOString();
  return {
    _id: '',
    userId: userId.toHexString(),
    enabled: true,
    pipelineId: null,
    pipelineLimit: 1,
    allowedFeatures: DEFAULT_FEATURES,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Returns the tenant's current SabBigin config, or a synthetic "default-on"
 * row if no config has been persisted yet. Never returns `null` from a
 * SabBigin route — the UI always has *something* to render.
 */
export async function getSabbiginConfig(): Promise<SabbiginConfigDoc | null> {
  const session = await getSession();
  if (!session?.user?._id) return null;

  if (useRustCrm()) {
    try {
      const current = await sabbiginConfigApi.current();
      if (current) return current;
    } catch (e) {
      console.error('[getSabbiginConfig] rust path failed; falling back:', e);
    }
  }

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id);
    const doc = await db
      .collection<Record<string, unknown>>(COLL)
      .findOne(
        { userId: userObjectId, status: { $ne: 'archived' } },
        { sort: { createdAt: -1 } },
      );
    if (!doc) return freshDefault(userObjectId);
    return JSON.parse(JSON.stringify(doc)) as SabbiginConfigDoc;
  } catch (e) {
    console.error('[getSabbiginConfig] mongo failed:', e);
    return null;
  }
}

export async function createSabbiginConfig(
  input: SabbiginConfigCreateInput,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied' };

  if (useRustCrm()) {
    try {
      const r = await sabbiginConfigApi.create(input);
      revalidatePath('/dashboard/sabbigin');
      return { success: true, id: r.id };
    } catch (e) {
      console.error('[createSabbiginConfig] rust failed; falling back:', e);
    }
  }

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id);
    const doc = {
      userId: userObjectId,
      enabled: input.enabled ?? true,
      pipelineId:
        input.pipelineId && ObjectId.isValid(input.pipelineId)
          ? new ObjectId(input.pipelineId)
          : null,
      pipelineLimit: Math.max(1, input.pipelineLimit ?? 1),
      allowedFeatures: input.allowedFeatures ?? DEFAULT_FEATURES,
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const r = await db.collection(COLL).insertOne(doc);
    revalidatePath('/dashboard/sabbigin');
    return { success: true, id: r.insertedId.toHexString() };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to create config' };
  }
}

export async function updateSabbiginConfig(
  id: string,
  patch: SabbiginConfigUpdateInput,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied' };
  if (!id || !ObjectId.isValid(id))
    return { success: false, error: 'Invalid config id' };

  if (useRustCrm()) {
    try {
      await sabbiginConfigApi.update(id, patch);
      revalidatePath('/dashboard/sabbigin');
      return { success: true };
    } catch (e) {
      console.error('[updateSabbiginConfig] rust failed; falling back:', e);
    }
  }

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id);
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.enabled != null) set.enabled = patch.enabled;
    if (patch.pipelineId !== undefined) {
      set.pipelineId =
        patch.pipelineId && ObjectId.isValid(patch.pipelineId)
          ? new ObjectId(patch.pipelineId)
          : null;
    }
    if (patch.pipelineLimit != null)
      set.pipelineLimit = Math.max(1, patch.pipelineLimit);
    if (patch.allowedFeatures) set.allowedFeatures = patch.allowedFeatures;
    if (patch.status) set.status = patch.status;
    const r = await db
      .collection(COLL)
      .updateOne(
        { _id: new ObjectId(id), userId: userObjectId },
        { $set: set },
      );
    if (r.matchedCount === 0)
      return { success: false, error: 'Config not found' };
    revalidatePath('/dashboard/sabbigin');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to update config' };
  }
}
